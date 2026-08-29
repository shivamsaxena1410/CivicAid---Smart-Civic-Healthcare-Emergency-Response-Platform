import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { OrgType, VerificationStatus } from '@prisma/client';

@Injectable()
export class PharmacyService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GeoSearchDto & { inStockOnly?: boolean }) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm = 20, inStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      type: OrgType.PHARMACY,
      verificationStatus: VerificationStatus.APPROVED,
    };

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        {
          pharmacyMedicines: {
            some: {
              OR: [
                { medicineName: { contains: search, mode: 'insensitive' } },
                { genericName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [total, pharmacies] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          pharmacyMedicines: {
            where: inStockOnly ? { inStock: true } : undefined,
            take: 20,
          },
        },
        skip,
        take: limit,
      }),
    ]);

    let processed = pharmacies.map((p) => {
      let distanceKm: number | null = null;
      if (lat && lng) {
        distanceKm = this.calculateHaversineDistance(lat, lng, p.latitude, p.longitude);
      }
      return {
        ...p,
        distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      };
    });

    if (lat && lng) {
      if (radiusKm) {
        processed = processed.filter((p) => p.distanceKm === null || p.distanceKm <= radiusKm);
      }
      processed.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    return {
      data: processed,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchMedicines(query: GeoSearchDto & { medicineName?: string; genericName?: string }) {
    const { page = 1, limit = 20, search, medicineName, genericName, lat, lng, radiusKm = 20 } = query;
    const skip = (page - 1) * limit;

    const searchTerm = search || medicineName || genericName;

    const where: any = {
      organization: {
        type: OrgType.PHARMACY,
        verificationStatus: VerificationStatus.APPROVED,
      },
    };

    if (searchTerm) {
      where.OR = [
        { medicineName: { contains: searchTerm, mode: 'insensitive' } },
        { genericName: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [total, medicines] = await Promise.all([
      this.prisma.pharmacyMedicine.count({ where }),
      this.prisma.pharmacyMedicine.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              phone: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [{ inStock: 'desc' }, { medicineName: 'asc' }],
      }),
    ]);

    let processed = medicines.map((m) => {
      let distanceKm: number | null = null;
      if (lat && lng && m.organization) {
        distanceKm = this.calculateHaversineDistance(lat, lng, m.organization.latitude, m.organization.longitude);
      }
      return {
        ...m,
        distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      };
    });

    if (lat && lng) {
      if (radiusKm) {
        processed = processed.filter((m) => m.distanceKm === null || m.distanceKm <= radiusKm);
      }
      processed.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    return {
      data: processed,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addMedicine(orgId: string, userId: string, userRole: string, dto: CreateMedicineDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });

    if (!org) {
      throw new NotFoundException('Pharmacy organization not found.');
    }

    if (org.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to manage medicines for this pharmacy.');
    }

    return this.prisma.pharmacyMedicine.create({
      data: {
        orgId,
        medicineName: dto.medicineName.trim(),
        genericName: dto.genericName?.trim(),
        category: dto.category?.trim(),
        price: dto.price,
        inStock: dto.inStock ?? true,
        quantity: dto.quantity ?? 0,
        lastUpdated: new Date(),
      },
    });
  }

  async updateMedicine(
    medicineId: string,
    userId: string,
    userRole: string,
    dto: Partial<CreateMedicineDto>,
  ) {
    const medicine = await this.prisma.pharmacyMedicine.findUnique({
      where: { id: medicineId },
      include: { organization: true },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    if (medicine.organization.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to edit this medicine record.');
    }

    return this.prisma.pharmacyMedicine.update({
      where: { id: medicineId },
      data: {
        ...dto,
        lastUpdated: new Date(),
      },
    });
  }

  async deleteMedicine(medicineId: string, userId: string, userRole: string) {
    const medicine = await this.prisma.pharmacyMedicine.findUnique({
      where: { id: medicineId },
      include: { organization: true },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    if (medicine.organization.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to delete this medicine record.');
    }

    await this.prisma.pharmacyMedicine.delete({ where: { id: medicineId } });
    return { message: 'Medicine deleted successfully.' };
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
