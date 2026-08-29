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
import { PharmacyService } from './pharmacy.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Pharmacies & Medicine Stock')
@Controller('pharmacies')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search verified pharmacies with proximity calculation' })
  @ApiQuery({ name: 'inStockOnly', type: Boolean, required: false })
  async findAll(
    @Query() query: GeoSearchDto,
    @Query('inStockOnly') inStockOnly?: boolean,
  ) {
    return this.pharmacyService.findAll({
      ...query,
      inStockOnly: String(inStockOnly) === 'true',
    });
  }

  @Public()
  @Get('medicines/search')
  @ApiOperation({ summary: 'Search medicines across all nearby pharmacies by generic or brand name' })
  @ApiQuery({ name: 'medicineName', type: String, required: false })
  @ApiQuery({ name: 'genericName', type: String, required: false })
  async searchMedicines(
    @Query() query: GeoSearchDto,
    @Query('medicineName') medicineName?: string,
    @Query('genericName') genericName?: string,
  ) {
    return this.pharmacyService.searchMedicines({
      ...query,
      medicineName,
      genericName,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':orgId/medicines')
  @ApiBearerAuth()
  @Roles(Role.PHARMACY, Role.ADMIN)
  @ApiOperation({ summary: 'Add a new medicine record to a pharmacy inventory' })
  async addMedicine(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicineDto,
  ) {
    return this.pharmacyService.addMedicine(orgId, user.id, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('medicines/:medicineId')
  @ApiBearerAuth()
  @Roles(Role.PHARMACY, Role.ADMIN)
  @ApiOperation({ summary: 'Update medicine stock availability or price' })
  async updateMedicine(
    @Param('medicineId') medicineId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<CreateMedicineDto>,
  ) {
    return this.pharmacyService.updateMedicine(medicineId, user.id, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('medicines/:medicineId')
  @ApiBearerAuth()
  @Roles(Role.PHARMACY, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a medicine from catalog' })
  async deleteMedicine(
    @Param('medicineId') medicineId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pharmacyService.deleteMedicine(medicineId, user.id, user.role);
  }
}
