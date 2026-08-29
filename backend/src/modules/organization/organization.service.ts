import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { OrgType, VerificationStatus } from '@prisma/client';

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
    const { page = 1, limit = 20, search, city, type, status, lat, lng, radiusKm = 15 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.verificationStatus = status;
    } else {
      where.verificationStatus = VerificationStatus.APPROVED; // Default only approved
    }

    if (type) {
      where.type = type;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          hospitalDetail: true,
          bloodBankInventory: true,
          ambulanceDetails: true,
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    // If user provided GPS coordinates, compute spherical distance & sort by proximity
    let processedItems = items.map((item) => {
      let distanceKm: number | null = null;
      if (lat && lng) {
        distanceKm = this.calculateHaversineDistance(lat, lng, item.latitude, item.longitude);
      }
      return {
        ...item,
        distanceKm: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      };
    });

    if (lat && lng) {
      // Filter within radius if specified
      if (radiusKm) {
        processedItems = processedItems.filter((i) => i.distanceKm === null || i.distanceKm <= radiusKm);
      }
      processedItems.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    return {
      data: processedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  async update(id: string, userId: string, userRole: string, dto: Partial<CreateOrganizationDto>) {
    const org = await this.prisma.organization.findUnique({ where: { id } });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    if (org.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to update this organization.');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...dto,
      },
      include: {
        hospitalDetail: true,
      },
    });
  }

  // Haversine distance utility (Spherical earth formula)
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
