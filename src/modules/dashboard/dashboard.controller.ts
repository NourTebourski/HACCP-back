import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('owner')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Owner dashboard: today compliance, overdue, weekly stats' })
  getOwnerDashboard(@CurrentUser() user: User) {
    return this.service.getOwnerDashboard(user.organizationId);
  }

  @Get('super-admin')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super admin dashboard: all orgs overview and compliance' })
  getSuperAdminDashboard() {
    return this.service.getSuperAdminDashboard();
  }
}
