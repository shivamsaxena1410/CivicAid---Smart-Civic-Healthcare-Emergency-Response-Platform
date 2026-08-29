import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SchemeService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { category?: string }) {
    const { page = 1, limit = 20, search, category } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

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

  async update(id: string, dto: Partial<CreateSchemeDto>) {
    await this.findOne(id);
    return this.prisma.governmentScheme.update({
      where: { id },
      data: { ...dto },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.governmentScheme.delete({ where: { id } });
    return { message: 'Scheme deleted successfully.' };
  }
}
