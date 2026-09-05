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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/create-medicine.dto';
import { PharmacySearchDto, MedicineSearchDto } from './dto/pharmacy-search.dto';
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
  async findAll(@Query() query: PharmacySearchDto) {
    return this.pharmacyService.findAll(query);
  }

  @Public()
  @Get('medicines/search')
  @ApiOperation({ summary: 'Search medicines across all nearby pharmacies by generic or brand name' })
  async searchMedicines(@Query() query: MedicineSearchDto) {
    return this.pharmacyService.searchMedicines(query);
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
    return this.pharmacyService.addMedicine(orgId, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('medicines/:medicineId')
  @ApiBearerAuth()
  @Roles(Role.PHARMACY, Role.ADMIN)
  @ApiOperation({ summary: 'Update medicine stock availability or price' })
  async updateMedicine(
    @Param('medicineId') medicineId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMedicineDto,
  ) {
    return this.pharmacyService.updateMedicine(medicineId, user, dto);
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
    return this.pharmacyService.deleteMedicine(medicineId, user);
  }
}
