import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { OrgType, Role } from '@prisma/client';

@ApiTags('Organizations & Healthcare Facilities')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search all verified healthcare organizations with location sorting' })
  @ApiQuery({ name: 'type', enum: OrgType, required: false })
  async findAll(
    @Query() query: GeoSearchDto,
    @Query('type') type?: OrgType,
  ) {
    return this.organizationService.findAll({ ...query, type });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get detailed organization profile (hospital beds, blood inventory, ambulance)' })
  async findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiBearerAuth()
  @Roles(Role.HOSPITAL, Role.BLOOD_BANK, Role.PHARMACY, Role.AMBULANCE, Role.NGO, Role.ADMIN)
  @ApiOperation({ summary: 'Register a new healthcare facility (requires admin KYC verification)' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update organization profile details' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<CreateOrganizationDto>,
  ) {
    return this.organizationService.update(id, user.id, user.role, dto);
  }
}
