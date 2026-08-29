import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AlertService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.emergencyAlert.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [total, alerts] = await Promise.all([
      this.prisma.emergencyAlert.count(),
      this.prisma.emergencyAlert.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      data: alerts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(authorityUserId: string, dto: CreateAlertDto) {
    return this.prisma.emergencyAlert.create({
      data: {
        createdById: authorityUserId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity,
        affectedArea: dto.affectedArea.trim(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async toggleActive(id: string, isActive: boolean) {
    const alert = await this.prisma.emergencyAlert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    return this.prisma.emergencyAlert.update({
      where: { id },
      data: { isActive },
    });
  }
}
