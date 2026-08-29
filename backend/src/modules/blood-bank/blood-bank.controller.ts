import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BloodBankService } from './blood-bank.service';
import { UpdateBloodInventoryDto } from './dto/update-inventory.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BloodType, Role } from '@prisma/client';

@ApiTags('Blood Banks & Availability')
@Controller('blood-banks')
export class BloodBankController {
  constructor(private readonly bloodBankService: BloodBankService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search blood banks by blood group (A+, B+, O-, etc.) and proximity' })
  @ApiQuery({ name: 'bloodType', enum: BloodType, required: false })
  @ApiQuery({ name: 'minUnits', type: Number, required: false, example: 1 })
  async findAll(
    @Query() query: GeoSearchDto,
    @Query('bloodType') bloodType?: BloodType,
    @Query('minUnits') minUnits?: number,
  ) {
    return this.bloodBankService.findAll({
      ...query,
      bloodType,
      minUnits: minUnits ? Number(minUnits) : 1,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get blood bank profile with full inventory breakdown across all 8 blood groups' })
  async findOne(@Param('id') id: string) {
    return this.bloodBankService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/inventory')
  @ApiBearerAuth()
  @Roles(Role.BLOOD_BANK, Role.ADMIN)
  @ApiOperation({ summary: 'Update blood inventory counts for a blood bank' })
  async updateInventory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBloodInventoryDto,
  ) {
    return this.bloodBankService.updateInventory(id, user.id, user.role, dto);
  }
}
