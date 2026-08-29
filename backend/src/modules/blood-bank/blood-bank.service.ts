import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBloodInventoryDto } from './dto/update-inventory.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { BloodType, OrgType, VerificationStatus } from '@prisma/client';

@Injectable()
export class BloodBankService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GeoSearchDto & { bloodType?: BloodType; minUnits?: number }) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm = 20, bloodType, minUnits = 1 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      type: OrgType.BLOOD_BANK,
      verificationStatus: VerificationStatus.APPROVED,
    };

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (bloodType) {
      where.bloodBankInventory = {
        some: {
          bloodType,
          unitsAvailable: { gte: minUnits },
        },
      };
    }

    const [total, bloodBanks] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          bloodBankInventory: {
            orderBy: { bloodType: 'asc' },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    let processed = bloodBanks.map((bb) => {
      let distanceKm: number | null = null;
      if (lat && lng) {
        distanceKm = this.calculateHaversineDistance(lat, lng, bb.latitude, bb.longitude);
      }
      return {
        ...bb,
        distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      };
    });

    if (lat && lng) {
      if (radiusKm) {
        processed = processed.filter((bb) => bb.distanceKm === null || bb.distanceKm <= radiusKm);
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

  async findOne(id: string) {
    const bloodBank = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        bloodBankInventory: {
          orderBy: { bloodType: 'asc' },
        },
      },
    });

    if (!bloodBank || bloodBank.type !== OrgType.BLOOD_BANK) {
      throw new NotFoundException('Blood bank not found.');
    }

    return bloodBank;
  }

  async updateInventory(
    orgId: string,
    userId: string,
    userRole: string,
    dto: UpdateBloodInventoryDto,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });

    if (!org) {
      throw new NotFoundException('Blood bank not found.');
    }

    if (org.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update inventory for this blood bank.');
    }

    for (const item of dto.inventory) {
      await this.prisma.bloodBankInventory.upsert({
        where: {
          orgId_bloodType: {
            orgId,
            bloodType: item.bloodType,
          },
        },
        update: {
          unitsAvailable: item.unitsAvailable,
          lastUpdated: new Date(),
        },
        create: {
          orgId,
          bloodType: item.bloodType,
          unitsAvailable: item.unitsAvailable,
          lastUpdated: new Date(),
        },
      });
    }

    return this.findOne(orgId);
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
