import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAmbulanceRequestDto,
  UpdateAmbulanceStatusDto,
  UpdateRequestStatusDto,
} from './dto/ambulance.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { AmbulanceStatus, AmbulanceRequestStatus, OrgType, VerificationStatus } from '@prisma/client';

@Injectable()
export class AmbulanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GeoSearchDto & { availableOnly?: boolean }) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm = 25, availableOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      type: OrgType.AMBULANCE_PROVIDER,
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

    const [total, providers] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          ambulanceDetails: {
            where: availableOnly ? { status: AmbulanceStatus.AVAILABLE } : undefined,
          },
        },
        skip,
        take: limit,
      }),
    ]);

    let processed = providers.map((p) => {
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

  async createRequest(citizenId: string, dto: CreateAmbulanceRequestDto) {
    return this.prisma.ambulanceRequest.create({
      data: {
        citizenId,
        ambulanceId: dto.ambulanceId,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        pickupAddress: dto.pickupAddress.trim(),
        emergencyDescription: dto.emergencyDescription.trim(),
        status: AmbulanceRequestStatus.REQUESTED,
      },
      include: {
        citizen: {
          select: { id: true, name: true, phone: true },
        },
        ambulance: true,
      },
    });
  }

  async getRequests(userId: string, userRole: string) {
    if (userRole === 'CITIZEN') {
      return this.prisma.ambulanceRequest.findMany({
        where: { citizenId: userId },
        include: {
          ambulance: {
            include: { organization: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // For ambulance provider / admin: return incoming requests
    return this.prisma.ambulanceRequest.findMany({
      include: {
        citizen: {
          select: { id: true, name: true, phone: true, email: true },
        },
        ambulance: {
          include: { organization: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateRequestStatus(requestId: string, dto: UpdateRequestStatusDto) {
    const request = await this.prisma.ambulanceRequest.findUnique({ where: { id: requestId } });

    if (!request) {
      throw new NotFoundException('Ambulance emergency request not found.');
    }

    const data: any = { status: dto.status };
    if (dto.status === AmbulanceRequestStatus.ACCEPTED) {
      data.respondedAt = new Date();
    } else if (dto.status === AmbulanceRequestStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    return this.prisma.ambulanceRequest.update({
      where: { id: requestId },
      data,
      include: {
        citizen: { select: { id: true, name: true, phone: true } },
        ambulance: true,
      },
    });
  }

  async updateAmbulanceStatus(
    ambulanceId: string,
    userId: string,
    userRole: string,
    dto: UpdateAmbulanceStatusDto,
  ) {
    const ambulance = await this.prisma.ambulanceDetail.findUnique({
      where: { id: ambulanceId },
      include: { organization: true },
    });

    if (!ambulance) {
      throw new NotFoundException('Ambulance vehicle record not found.');
    }

    if (ambulance.organization.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to manage this ambulance fleet vehicle.');
    }

    return this.prisma.ambulanceDetail.update({
      where: { id: ambulanceId },
      data: {
        status: dto.status,
        statusUpdatedAt: new Date(),
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
