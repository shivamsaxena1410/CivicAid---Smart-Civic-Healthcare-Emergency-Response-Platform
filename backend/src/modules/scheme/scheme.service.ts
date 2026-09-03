import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchemeDto, UpdateSchemeDto } from './dto/create-scheme.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SchemeService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { category?: string }) {
    const { page = 1, limit = 20, search, category } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GovernmentSchemeWhereInput = { isActive: true };

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { eligibilityCriteria: { contains: search, mode: 'insensitive' } },
        { benefits: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, schemes] = await Promise.all([
      this.prisma.governmentScheme.count({ where }),
      this.prisma.governmentScheme.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: schemes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const scheme = await this.prisma.governmentScheme.findUnique({ where: { id } });

    if (!scheme) {
      throw new NotFoundException('Government health scheme not found.');
    }

    return scheme;
  }

  async create(authorityUserId: string, dto: CreateSchemeDto) {
    return this.prisma.governmentScheme.create({
      data: {
        createdById: authorityUserId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        eligibilityCriteria: dto.eligibilityCriteria.trim(),
        benefits: dto.benefits.trim(),
        applicationUrl: dto.applicationUrl?.trim(),
        category: dto.category?.trim() || 'General',
        documentsRequired: dto.documentsRequired || [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Throws unless this caller may modify the scheme.
   *
   * `update` and `delete` previously had no check at all beyond the AUTHORITY
   * role guard, so any authority account could rewrite or delete a scheme
   * published by a different authority — including changing the application URL
   * that citizens are directed to.
   */
  private async assertSchemeAccess(id: string, user: AuthenticatedUser) {
    const scheme = await this.prisma.governmentScheme.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!scheme) {
      throw new NotFoundException('Government health scheme not found.');
    }

    if (scheme.createdById !== user.id && user.role !== Role.ADMIN) {
      // Same message as not-found: distinguishing them would confirm which
      // scheme ids exist to a caller not entitled to know.
      throw new NotFoundException('Government health scheme not found.');
    }

    return scheme;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateSchemeDto) {
    await this.assertSchemeAccess(id, user);

    // Explicit field writes rather than `data: { ...dto }`. Spreading the DTO
    // lets any extra property the client sends reach Prisma, which is how
    // `createdById` would become client-controlled.
    return this.prisma.governmentScheme.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.eligibilityCriteria !== undefined && { eligibilityCriteria: dto.eligibilityCriteria.trim() }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits.trim() }),
        ...(dto.applicationUrl !== undefined && { applicationUrl: dto.applicationUrl?.trim() ?? null }),
        ...(dto.category !== undefined && { category: dto.category?.trim() || 'General' }),
        ...(dto.documentsRequired !== undefined && { documentsRequired: dto.documentsRequired }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.assertSchemeAccess(id, user);
    await this.prisma.governmentScheme.delete({ where: { id } });
    return { message: 'Scheme deleted successfully.' };
  }
}
