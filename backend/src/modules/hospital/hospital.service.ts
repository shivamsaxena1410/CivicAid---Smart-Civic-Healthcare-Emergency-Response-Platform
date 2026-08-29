import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateHospitalCapacityDto } from './dto/update-capacity.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { OrgType, VerificationStatus } from '@prisma/client';

@Injectable()
export class HospitalService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    query: GeoSearchDto & {
      icuOnly?: boolean;
      emergencyOnly?: boolean;
      oxygenOnly?: boolean;
      ventilatorOnly?: boolean;
      department?: string;
    },
  ) {
    const {
      page = 1,
      limit = 20,
      search,
      city,
      lat,
      lng,
      radiusKm = 20,
      icuOnly,
      emergencyOnly,
      oxygenOnly,
      ventilatorOnly,
      department,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      type: OrgType.HOSPITAL,
      verificationStatus: VerificationStatus.APPROVED,
      hospitalDetail: {
        isNot: null,
      },
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

    const hospitalDetailWhere: any = {};
    if (icuOnly) {
      hospitalDetailWhere.availableIcuBeds = { gt: 0 };
    }
    if (emergencyOnly) {
      hospitalDetailWhere.emergencyAvailable = true;
    }
    if (oxygenOnly) {
      hospitalDetailWhere.hasOxygenSupport = true;
    }
    if (ventilatorOnly) {
      hospitalDetailWhere.hasVentilators = true;
    }
    if (department) {
      hospitalDetailWhere.departments = { has: department };
    }

    if (Object.keys(hospitalDetailWhere).length > 0) {
      where.hospitalDetail = hospitalDetailWhere;
    }

    const [total, hospitals] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          hospitalDetail: true,
        },
        skip,
        take: limit,
      }),
    ]);

    let processed = hospitals.map((h) => {
      let distanceKm: number | null = null;
      if (lat && lng) {
        distanceKm = this.calculateHaversineDistance(lat, lng, h.latitude, h.longitude);
      }
      return {
        ...h,
        distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      };
    });

    if (lat && lng) {
      if (radiusKm) {
        processed = processed.filter((h) => h.distanceKm === null || h.distanceKm <= radiusKm);
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
    const hospital = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        hospitalDetail: true,
        ambulanceDetails: true,
      },
    });

    if (!hospital || hospital.type !== OrgType.HOSPITAL) {
      throw new NotFoundException('Hospital not found.');
    }

    return hospital;
  }

  async updateCapacity(
    orgId: string,
    userId: string,
    userRole: string,
    dto: UpdateHospitalCapacityDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { hospitalDetail: true },
    });

    if (!org) {
      throw new NotFoundException('Hospital organization not found.');
    }

    if (org.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update bed capacities for this hospital.');
    }

    return this.prisma.hospitalDetail.upsert({
      where: { orgId },
      update: {
        ...dto,
        availabilityUpdatedAt: new Date(),
      },
      create: {
        orgId,
        totalBeds: dto.totalBeds || 100,
        availableGeneralBeds: dto.availableGeneralBeds || 0,
        availableIcuBeds: dto.availableIcuBeds || 0,
        emergencyAvailable: dto.emergencyAvailable ?? true,
        hasOxygenSupport: dto.hasOxygenSupport ?? true,
        hasVentilators: dto.hasVentilators ?? true,
        departments: dto.departments || [],
        services: dto.services || [],
        operatingHours: dto.operatingHours || '24/7',
        availabilityUpdatedAt: new Date(),
      },
    });
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
