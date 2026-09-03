import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBloodInventoryDto } from './dto/update-inventory.dto';
import { BloodBankSearchDto } from './dto/blood-bank-search.dto';
import { OrgType, Prisma, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOrgAccess } from '../../common/authorization/assert-org-access';
import { searchOrganizationsByProximity, toGeoQuery } from '../../common/geo/geo-search';

@Injectable()
export class BloodBankService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: BloodBankSearchDto) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm, bloodType, minUnits = 1 } = query;

    const where: Prisma.OrganizationWhereInput = {
      type: OrgType.BLOOD_BANK,
      verificationStatus: VerificationStatus.APPROVED,
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(bloodType && {
        bloodBankInventory: { some: { bloodType, unitsAvailable: { gte: minUnits } } },
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
          include: { bloodBankInventory: { orderBy: { bloodType: 'asc' } } },
        }),
    });
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

  async updateInventory(orgId: string, user: AuthenticatedUser, dto: UpdateBloodInventoryDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });

    assertOrgAccess(org, user, { requireApproved: true, resourceName: 'blood bank' });

    // One transaction: a partial inventory update would leave the bank
    // advertising stock for some blood types and stale figures for others.
    await this.prisma.$transaction(
      dto.inventory.map((item) =>
        this.prisma.bloodBankInventory.upsert({
          where: { orgId_bloodType: { orgId, bloodType: item.bloodType } },
          update: { unitsAvailable: item.unitsAvailable, lastUpdated: new Date() },
          create: {
            orgId,
            bloodType: item.bloodType,
            unitsAvailable: item.unitsAvailable,
            lastUpdated: new Date(),
          },
        }),
      ),
    );

    return this.findOne(orgId);
  }
}
