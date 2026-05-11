import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get(':organizationId/monthly/:year/:month')
  @Roles(Role.SUPER_ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Generate monthly HACCP compliance report' })
  generateMonthlyReport(
    @Param('organizationId') organizationId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @CurrentUser() user: User,
  ) {
    return this.service.generateMonthlyReport(
      organizationId,
      parseInt(year, 10),
      parseInt(month, 10),
      user,
    );
  }

  @Get(':organizationId/compliance-summary')
  @Roles(Role.SUPER_ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get compliance summary for last N days' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  complianceSummary(
    @Param('organizationId') organizationId: string,
    @Query('days') days: number = 30,
    @CurrentUser() user: User,
  ) {
    return this.service.complianceSummary(organizationId, days, user);
  }
}
