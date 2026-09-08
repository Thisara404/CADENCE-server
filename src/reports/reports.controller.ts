import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SaveDraftDto } from './dto/create-draft.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, ReportStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('draft')
  async saveDraft(@CurrentUser('id') userId: string, @Body() dto: SaveDraftDto) {
    return this.reportsService.saveDraft(userId, dto);
  }

  @Post(':id/submit')
  async submitReport(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SubmitReportDto,
  ) {
    return this.reportsService.submitReport(userId, id, dto);
  }

  @Get('my-history')
  async getMyHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getMyHistory(userId, page, limit);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Get()
  async findAll(
    @Query('week') week?: string,
    @Query('memberId') memberId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ReportStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.findAll({
      weekStartDate: week,
      userId: memberId,
      projectId,
      status,
      page,
      limit,
    });
  }

  @UseGuards(OwnershipGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Roles(Role.MANAGER, Role.ADMIN)
  @Post(':id/review')
  async reviewReport(
    @CurrentUser('id') reviewerId: string,
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportsService.reviewReport(id, reviewerId, dto);
  }
}
