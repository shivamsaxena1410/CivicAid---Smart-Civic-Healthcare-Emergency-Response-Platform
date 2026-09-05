import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalService } from './hospital.service';
import { UpdateHospitalCapacityDto } from './dto/update-capacity.dto';
import { HospitalSearchDto } from './dto/hospital-search.dto';
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
  async findAll(@Query() query: HospitalSearchDto) {
    return this.hospitalService.findAll(query);
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
    return this.hospitalService.updateCapacity(id, user, dto);
  }
}
