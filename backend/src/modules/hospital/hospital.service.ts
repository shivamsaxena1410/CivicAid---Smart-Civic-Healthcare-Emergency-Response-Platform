import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateHospitalCapacityDto } from './dto/update-capacity.dto';
import { HospitalSearchDto } from './dto/hospital-search.dto';
import { OrgType, Prisma, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOrgAccess } from '../../common/authorization/assert-org-access';
import { searchOrganizationsByProximity, toGeoQuery } from '../../common/geo/geo-search';

@Injectable()
export class HospitalService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: HospitalSearchDto) {
    const {
      page = 1,
      limit = 20,
      search,
      city,
      lat,
      lng,
      radiusKm,
      icuOnly,
      emergencyOnly,
      oxygenOnly,
      ventilatorOnly,
      department,
    } = query;

    const hospitalDetailWhere: Prisma.HospitalDetailWhereInput = {
      ...(icuOnly && { availableIcuBeds: { gt: 0 } }),
      ...(emergencyOnly && { emergencyAvailable: true }),
      ...(oxygenOnly && { hasOxygenSupport: true }),
      ...(ventilatorOnly && { hasVentilators: true }),
      ...(department && { departments: { has: department } }),
    };

    const where: Prisma.OrganizationWhereInput = {
      type: OrgType.HOSPITAL,
      verificationStatus: VerificationStatus.APPROVED,
      hospitalDetail:
        Object.keys(hospitalDetailWhere).length > 0 ? { is: hospitalDetailWhere } : { isNot: null },
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    return searchOrganizationsByProximity(this.prisma, {
      where,
      geo: toGeoQuery({ lat, lng, radiusKm }),
      page,
      limit,
      hydrate: (args) => this.prisma.organization.findMany({ ...args, include: { hospitalDetail: true } }),
    });
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

  async updateCapacity(orgId: string, user: AuthenticatedUser, dto: UpdateHospitalCapacityDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { hospitalDetail: true },
    });

    // requireApproved: bed and ICU counts are exactly what a person in an
    // emergency drives across a city on. A self-registered, unreviewed
    // organisation must not be able to publish them.
    assertOrgAccess(org, user, { requireApproved: true, resourceName: 'hospital' });

    return this.prisma.hospitalDetail.upsert({
      where: { orgId },
      update: {
        ...(dto.totalBeds !== undefined && { totalBeds: dto.totalBeds }),
        ...(dto.availableGeneralBeds !== undefined && { availableGeneralBeds: dto.availableGeneralBeds }),
        ...(dto.availableIcuBeds !== undefined && { availableIcuBeds: dto.availableIcuBeds }),
        ...(dto.emergencyAvailable !== undefined && { emergencyAvailable: dto.emergencyAvailable }),
        ...(dto.hasOxygenSupport !== undefined && { hasOxygenSupport: dto.hasOxygenSupport }),
        ...(dto.hasVentilators !== undefined && { hasVentilators: dto.hasVentilators }),
        ...(dto.departments !== undefined && { departments: dto.departments }),
        ...(dto.services !== undefined && { services: dto.services }),
        ...(dto.operatingHours !== undefined && { operatingHours: dto.operatingHours }),
        availabilityUpdatedAt: new Date(),
      },
      create: {
        orgId,
        totalBeds: dto.totalBeds ?? 0,
        availableGeneralBeds: dto.availableGeneralBeds ?? 0,
        availableIcuBeds: dto.availableIcuBeds ?? 0,
        emergencyAvailable: dto.emergencyAvailable ?? false,
        hasOxygenSupport: dto.hasOxygenSupport ?? false,
        hasVentilators: dto.hasVentilators ?? false,
        departments: dto.departments ?? [],
        services: dto.services ?? [],
        operatingHours: dto.operatingHours ?? '24/7',
        availabilityUpdatedAt: new Date(),
      },
    });
  }
}
