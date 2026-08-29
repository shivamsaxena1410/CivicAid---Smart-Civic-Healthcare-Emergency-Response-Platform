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
import { HospitalService } from './hospital.service';
import { UpdateHospitalCapacityDto } from './dto/update-capacity.dto';
import { GeoSearchDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Hospitals & Live Capacity')
@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search hospitals with live ICU, General bed counts and distance' })
  @ApiQuery({ name: 'icuOnly', type: Boolean, required: false })
  @ApiQuery({ name: 'emergencyOnly', type: Boolean, required: false })
  @ApiQuery({ name: 'oxygenOnly', type: Boolean, required: false })
  @ApiQuery({ name: 'ventilatorOnly', type: Boolean, required: false })
  @ApiQuery({ name: 'department', type: String, required: false })
  async findAll(
    @Query() query: GeoSearchDto,
    @Query('icuOnly') icuOnly?: boolean,
    @Query('emergencyOnly') emergencyOnly?: boolean,
    @Query('oxygenOnly') oxygenOnly?: boolean,
    @Query('ventilatorOnly') ventilatorOnly?: boolean,
    @Query('department') department?: string,
  ) {
    return this.hospitalService.findAll({
      ...query,
      icuOnly: String(icuOnly) === 'true',
      emergencyOnly: String(emergencyOnly) === 'true',
      oxygenOnly: String(oxygenOnly) === 'true',
      ventilatorOnly: String(ventilatorOnly) === 'true',
      department,
    });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get single hospital details with current bed availability' })
  async findOne(@Param('id') id: string) {
    return this.hospitalService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/capacity')
  @ApiBearerAuth()
  @Roles(Role.HOSPITAL, Role.ADMIN)
  @ApiOperation({ summary: 'Update hospital ICU/general bed counts and emergency status' })
  async updateCapacity(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHospitalCapacityDto,
  ) {
    return this.hospitalService.updateCapacity(id, user.id, user.role, dto);
  }
}
