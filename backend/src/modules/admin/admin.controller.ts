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
import { AdminService } from './admin.service';
import { VerifyOrganizationDto, ToggleUserStatusDto } from './dto/admin.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin & Platform Governance')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get system-wide metrics and total live bed/blood capacities' })
  async getAnalytics() {
    return this.adminService.getPlatformAnalytics();
  }

  @Get('organizations/pending')
  @ApiOperation({ summary: 'List healthcare facilities awaiting administrative KYC verification' })
  async getPendingOrganizations(@Query() query: PaginationDto) {
    return this.adminService.getPendingOrganizations(query);
  }

  @Patch('organizations/:orgId/verify')
  @ApiOperation({ summary: 'Approve, reject or suspend an organization' })
  async verifyOrganization(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyOrganizationDto,
  ) {
    return this.adminService.verifyOrganization(orgId, user.id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all registered user accounts' })
  async getUsers(@Query() query: PaginationDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Enable or suspend a user account' })
  async toggleUserStatus(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ToggleUserStatusDto,
  ) {
    return this.adminService.toggleUserStatus(userId, user.id, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Retrieve immutable administrative audit logs' })
  async getAuditLogs(@Query() query: PaginationDto) {
    return this.adminService.getAuditLogs(query);
  }
}
