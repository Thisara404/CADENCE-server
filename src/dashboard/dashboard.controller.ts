import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Query('week') week?: string) {
    return this.dashboardService.getSummary(week);
  }

  @Get('charts')
  async getCharts(
    @Query('week') week?: string,
    @Query('projectId') projectId?: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.dashboardService.getCharts(week, projectId, memberId);
  }

  @Get('blockers-and-achievements')
  async getBlockersAndAchievements(@Query('week') week?: string) {
    return this.dashboardService.getBlockersAndAchievements(week);
  }
}
