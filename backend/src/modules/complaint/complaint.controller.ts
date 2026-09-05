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
import { ComplaintService } from './complaint.service';
import { CreateComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Citizen Grievances & Complaints')
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a citizen healthcare grievance / complaint' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List complaints (scoped to citizen personal filings or admin/authority oversight)' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ComplaintQueryDto,
  ) {
    return this.complaintService.findAll(user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full complaint lifecycle details with investigation notes' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.complaintService.findOne(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/resolve')
  @ApiBearerAuth()
  @Roles(Role.AUTHORITY, Role.ADMIN)
  @ApiOperation({ summary: 'Resolve or update grievance status with official findings' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.complaintService.resolve(id, user, dto);
  }
}
