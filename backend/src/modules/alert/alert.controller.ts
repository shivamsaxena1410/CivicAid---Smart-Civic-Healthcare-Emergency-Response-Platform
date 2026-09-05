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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertService } from './alert.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Emergency Health Alerts')
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Get current high-priority public health alerts and advisories' })
  async findActive() {
    return this.alertService.findActive();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all broadcast alerts history' })
  async findAll(@Query() query: PaginationDto) {
    return this.alertService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiBearerAuth()
  @Roles(Role.AUTHORITY, Role.ADMIN)
  @ApiOperation({ summary: 'Broadcast an urgent emergency health alert' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAlertDto,
  ) {
    return this.alertService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/toggle')
  @ApiBearerAuth()
  @Roles(Role.AUTHORITY, Role.ADMIN)
  @ApiOperation({ summary: 'Activate or archive an alert' })
  async toggle(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.alertService.toggleActive(id, isActive);
  }
}
