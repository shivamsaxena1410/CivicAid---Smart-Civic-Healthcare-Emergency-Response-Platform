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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AmbulanceService } from './ambulance.service';
import {
  CreateAmbulanceRequestDto,
  UpdateAmbulanceStatusDto,
  UpdateRequestStatusDto,
  AmbulanceSearchDto,
} from './dto/ambulance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Ambulance & Emergency Dispatch')
@Controller('ambulances')
export class AmbulanceController {
  constructor(private readonly ambulanceService: AmbulanceService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search available emergency ambulance providers and vehicles' })
  @ApiQuery({ name: 'availableOnly', type: Boolean, required: false })
  async findAll(@Query() query: AmbulanceSearchDto) {
    return this.ambulanceService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an urgent ambulance dispatch request' })
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAmbulanceRequestDto,
  ) {
    return this.ambulanceService.createRequest(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ambulance requests (citizen personal requests or provider dispatch queue)' })
  async getRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.ambulanceService.getRequests(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('requests/:requestId/status')
  @ApiBearerAuth()
  @Roles(Role.AMBULANCE, Role.ADMIN, Role.CITIZEN)
  @ApiOperation({ summary: 'Update ambulance dispatch status (ACCEPTED, EN_ROUTE, COMPLETED, CANCELLED)' })
  async updateRequestStatus(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.ambulanceService.updateRequestStatus(requestId, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':ambulanceId/status')
  @ApiBearerAuth()
  @Roles(Role.AMBULANCE, Role.ADMIN)
  @ApiOperation({ summary: 'Toggle vehicle live status (AVAILABLE, BUSY, OFFLINE)' })
  async updateAmbulanceStatus(
    @Param('ambulanceId') ambulanceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAmbulanceStatusDto,
  ) {
    return this.ambulanceService.updateAmbulanceStatus(ambulanceId, user, dto);
  }
}
