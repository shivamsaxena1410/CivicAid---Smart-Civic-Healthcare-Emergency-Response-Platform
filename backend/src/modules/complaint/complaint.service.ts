import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ComplaintStatus } from '@prisma/client';

@Injectable()
export class ComplaintService {
  constructor(private prisma: PrismaService) {}

  async create(citizenId: string, dto: CreateComplaintDto) {
    return this.prisma.complaint.create({
      data: {
        citizenId,
        organizationId: dto.organizationId,
        category: dto.category.trim(),
        description: dto.description.trim(),
        attachmentUrl: dto.attachmentUrl?.trim(),
        status: ComplaintStatus.PENDING,
      },
      include: {
        organization: true,
      },
    });
  }

  async findAll(
    user: { id: string; role: string },
    query: PaginationDto & { status?: ComplaintStatus },
  ) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (user.role === 'CITIZEN') {
      where.citizenId = user.id;
    } else if (user.role === 'HOSPITAL' || user.role === 'PHARMACY' || user.role === 'BLOOD_BANK') {
      // Find complaints targeting this organization
      const userOrg = await this.prisma.organization.findFirst({ where: { userId: user.id } });
      if (userOrg) {
        where.organizationId = userOrg.id;
      }
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, complaints] = await Promise.all([
      this.prisma.complaint.count({ where }),
      this.prisma.complaint.findMany({
        where,
        include: {
          citizen: { select: { id: true, name: true, email: true, phone: true } },
          organization: { select: { id: true, name: true, type: true, city: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: complaints,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        citizen: { select: { id: true, name: true, email: true, phone: true } },
        organization: true,
        resolvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint record not found.');
    }

    return complaint;
  }

  async resolve(id: string, resolvedById: string, dto: ResolveComplaintDto) {
    await this.findOne(id);

    return this.prisma.complaint.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes.trim(),
        resolvedById,
        resolvedAt: new Date(),
      },
      include: {
        citizen: { select: { id: true, name: true, email: true } },
        organization: true,
      },
    });
  }
}
