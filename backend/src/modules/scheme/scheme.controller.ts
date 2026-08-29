import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SchemeService } from './scheme.service';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Government Health Schemes')
@Controller('schemes')
export class SchemeController {
  constructor(private readonly schemeService: SchemeService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List and search public health schemes (PM-JAY, ABHA, Jan Aushadhi)' })
  @ApiQuery({ name: 'category', type: String, required: false })
  async findAll(
    @Query() query: PaginationDto,
    @Query('category') category?: string,
  ) {
    return this.schemeService.findAll({ ...query, category });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get details, benefits and eligibility criteria for a specific scheme' })
  async findOne(@Param('id') id: string) {
    return this.schemeService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiBearerAuth()
  @Roles(Role.AUTHORITY, Role.ADMIN)
  @ApiOperation({ summary: 'Publish a new government health scheme' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSchemeDto,
  ) {
    return this.schemeService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.AUTHORITY, Role.ADMIN)
  @ApiOperation({ summary: 'Update health scheme information' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateSchemeDto>,
  ) {
    return this.schemeService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a health scheme' })
  async delete(@Param('id') id: string) {
    return this.schemeService.delete(id);
  }
}
