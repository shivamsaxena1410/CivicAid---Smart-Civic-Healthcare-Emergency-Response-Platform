import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifyOrganizationDto, ToggleUserStatusDto } from './dto/admin.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Prisma, VerificationStatus, OrgType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformAnalytics() {
    const [
      totalUsers,
      totalHospitals,
      totalBloodBanks,
      totalPharmacies,
      totalAmbulances,
      pendingVerifications,
      totalComplaints,
      resolvedComplaints,
      hospitalDetails,
      bloodInventories,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count({ where: { type: OrgType.HOSPITAL } }),
      this.prisma.organization.count({ where: { type: OrgType.BLOOD_BANK } }),
      this.prisma.organization.count({ where: { type: OrgType.PHARMACY } }),
      this.prisma.organization.count({ where: { type: OrgType.AMBULANCE_PROVIDER } }),
      this.prisma.organization.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      this.prisma.complaint.count(),
      this.prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      this.prisma.hospitalDetail.aggregate({
        _sum: {
          totalBeds: true,
          availableGeneralBeds: true,
          availableIcuBeds: true,
        },
      }),
      this.prisma.bloodBankInventory.aggregate({
        _sum: {
          unitsAvailable: true,
        },
      }),
    ]);

    return {
      overview: {
        totalUsers,
        totalHospitals,
        totalBloodBanks,
        totalPharmacies,
        totalAmbulances,
        pendingVerifications,
        totalComplaints,
        resolvedComplaints,
      },
      capacityMetrics: {
        totalBeds: hospitalDetails._sum.totalBeds || 0,
        availableGeneralBeds: hospitalDetails._sum.availableGeneralBeds || 0,
        availableIcuBeds: hospitalDetails._sum.availableIcuBeds || 0,
        totalBloodUnitsInStock: bloodInventories._sum.unitsAvailable || 0,
      },
    };
  }

  async getPendingOrganizations(query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { verificationStatus: VerificationStatus.PENDING };

    const [total, items] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async verifyOrganization(orgId: string, adminUserId: string, dto: VerifyOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        verificationStatus: dto.status,
        rejectionReason: dto.rejectionReason?.trim(),
        verifiedAt: new Date(),
        verifiedById: adminUserId,
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: `ORGANIZATION_VERIFICATION_${dto.status}`,
        entityType: 'Organization',
        entityId: orgId,
        newValues: { status: dto.status, reason: dto.rejectionReason },
      },
    });

    return updated;
  }

  async getUsers(query: PaginationDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleUserStatus(userId: string, adminUserId: string, dto: ToggleUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: dto.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: userId,
      },
    });

    return updated;
  }

  async getAuditLogs(query: PaginationDto) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
