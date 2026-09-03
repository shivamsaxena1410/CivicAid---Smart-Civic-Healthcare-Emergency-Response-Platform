import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/create-organization.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { OrgType, Prisma, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOrgAccess } from '../../common/authorization/assert-org-access';
import { searchOrganizationsByProximity, toGeoQuery } from '../../common/geo/geo-search';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        description: dto.description?.trim(),
        address: dto.address.trim(),
        city: dto.city.trim(),
        state: dto.state.trim(),
        pincode: dto.pincode.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone.trim(),
        email: dto.email.toLowerCase().trim(),
        website: dto.website?.trim(),
        licenseNumber: dto.licenseNumber?.trim(),
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  }

  async findAll(query: GeoSearchDto & { type?: OrgType; status?: VerificationStatus }) {
    const { page = 1, limit = 20, search, city, type, status, lat, lng, radiusKm } = query;

    const where: Prisma.OrganizationWhereInput = {
      // Unapproved organisations are excluded unless a status is asked for
      // explicitly. The status filter is only reachable by admins — see
      // organization.controller.ts — so this endpoint cannot be used to
      // enumerate pending registrations.
      verificationStatus: status ?? VerificationStatus.APPROVED,
      ...(type && { type }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
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
            hospitalDetail: true,
            bloodBankInventory: true,
            ambulanceDetails: true,
          },
        }),
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        hospitalDetail: true,
        bloodBankInventory: true,
        pharmacyMedicines: {
          take: 50,
          orderBy: { inStock: 'desc' },
        },
        ambulanceDetails: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found.`);
    }

    return org;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });

    assertOrgAccess(org, user);

    // Explicit field writes. `data: { ...dto }` forwarded whatever the client
    // sent, and since the body was typed `Partial<CreateOrganizationDto>` it was
    // never validated (see UpdateOrganizationDto for why), so `userId` and
    // `verificationStatus` were client-settable: an owner could approve their
    // own organisation, or reassign it to another account.
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() ?? null }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.city !== undefined && { city: dto.city.trim() }),
        ...(dto.state !== undefined && { state: dto.state.trim() }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode.trim() }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase().trim() }),
        ...(dto.website !== undefined && { website: dto.website?.trim() ?? null }),
        ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber?.trim() ?? null }),
      },
      include: {
        hospitalDetail: true,
      },
    });
  }
}
