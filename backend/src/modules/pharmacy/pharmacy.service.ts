import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/create-medicine.dto';
import { PharmacySearchDto, MedicineSearchDto } from './dto/pharmacy-search.dto';
import { OrgType, Prisma, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOrgAccess } from '../../common/authorization/assert-org-access';
import { distancesWithinRadius, searchOrganizationsByProximity, toGeoQuery } from '../../common/geo/geo-search';

@Injectable()
export class PharmacyService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PharmacySearchDto) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm, inStockOnly } = query;

    const where: Prisma.OrganizationWhereInput = {
      type: OrgType.PHARMACY,
      verificationStatus: VerificationStatus.APPROVED,
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
          {
            pharmacyMedicines: {
              some: {
                OR: [
                  { medicineName: { contains: search, mode: 'insensitive' as const } },
                  { genericName: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ],
      }),
    };

    return searchOrganizationsByProximity(this.prisma, {
      where,
      geo: toGeoQuery({ lat, lng, radiusKm }),
      page,
      limit,
      hydrate: (args) =>
        this.prisma.organization.findMany({
          ...args,
          include: {
            pharmacyMedicines: {
              where: inStockOnly ? { inStock: true } : undefined,
              take: 20,
              orderBy: [{ inStock: 'desc' }, { medicineName: 'asc' }],
            },
          },
        }),
    });
  }

  /**
   * Medicine-first search: the rows are medicines, each attached to a pharmacy.
   *
   * The proximity helper is organisation-first, so this path resolves the
   * in-radius pharmacies up front and constrains the medicine query to them.
   * That keeps the radius filter in Postgres and applies it *before* pagination
   * — previously the page was fetched first and then filtered in JavaScript, so
   * a search for a drug within 5 km could return an empty page while stock
   * existed 2 km away.
   */
  async searchMedicines(query: MedicineSearchDto) {
    const { page = 1, limit = 20, search, medicineName, genericName, lat, lng, radiusKm, inStockOnly } = query;
    const skip = (page - 1) * limit;
    const searchTerm = search || medicineName || genericName;
    const geo = toGeoQuery({ lat, lng, radiusKm });

    const organizationWhere: Prisma.OrganizationWhereInput = {
      type: OrgType.PHARMACY,
      verificationStatus: VerificationStatus.APPROVED,
    };

    let distances: Map<string, number> | null = null;
    if (geo) {
      const candidates = await this.prisma.organization.findMany({
        where: organizationWhere,
        select: { id: true },
      });
      distances = await distancesWithinRadius(
        this.prisma,
        candidates.map((c) => c.id),
        geo,
      );
      if (distances.size === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
    }

    const where: Prisma.PharmacyMedicineWhereInput = {
      organization: distances ? { ...organizationWhere, id: { in: [...distances.keys()] } } : organizationWhere,
      ...(inStockOnly && { inStock: true }),
      ...(searchTerm && {
        OR: [
          { medicineName: { contains: searchTerm, mode: 'insensitive' as const } },
          { genericName: { contains: searchTerm, mode: 'insensitive' as const } },
          { category: { contains: searchTerm, mode: 'insensitive' as const } },
        ],
      }),
    };

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
        orderBy: [{ inStock: 'desc' }, { medicineName: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return {
      data: medicines.map((m) => ({
        ...m,
        distanceKm: distances?.get(m.orgId) ?? null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async addMedicine(orgId: string, user: AuthenticatedUser, dto: CreateMedicineDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });

    assertOrgAccess(org, user, { requireApproved: true, resourceName: 'pharmacy' });

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

  async updateMedicine(medicineId: string, user: AuthenticatedUser, dto: UpdateMedicineDto) {
    const medicine = await this.prisma.pharmacyMedicine.findUnique({
      where: { id: medicineId },
      include: { organization: true },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    assertOrgAccess(medicine.organization, user, { requireApproved: true, resourceName: 'pharmacy' });

    return this.prisma.pharmacyMedicine.update({
      where: { id: medicineId },
      data: {
        ...(dto.medicineName !== undefined && { medicineName: dto.medicineName.trim() }),
        ...(dto.genericName !== undefined && { genericName: dto.genericName?.trim() ?? null }),
        ...(dto.category !== undefined && { category: dto.category?.trim() ?? null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.inStock !== undefined && { inStock: dto.inStock }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        lastUpdated: new Date(),
      },
    });
  }

  async deleteMedicine(medicineId: string, user: AuthenticatedUser) {
    const medicine = await this.prisma.pharmacyMedicine.findUnique({
      where: { id: medicineId },
      include: { organization: true },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found.');
    }

    assertOrgAccess(medicine.organization, user, { resourceName: 'pharmacy' });

    await this.prisma.pharmacyMedicine.delete({ where: { id: medicineId } });
    return { message: 'Medicine deleted successfully.' };
  }
}
