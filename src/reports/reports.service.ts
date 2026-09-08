import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDraftDto } from './dto/create-draft.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { ReviewReportDto, ReviewActionType } from './dto/review-report.dto';
import { ReportStatus, ReviewAction } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async saveDraft(userId: string, dto: SaveDraftDto) {
    let report;

    if (dto.reportId) {
      report = await this.prisma.report.findUnique({
        where: { id: dto.reportId },
        include: { versions: true },
      });

      if (!report) {
        throw new NotFoundException(`Report with ID ${dto.reportId} not found`);
      }

      if (report.userId !== userId) {
        throw new ForbiddenException('Cannot edit another member’s report');
      }

      if (report.status !== ReportStatus.DRAFT && report.status !== ReportStatus.NEEDS_CORRECTION) {
        throw new BadRequestException('Cannot edit a report that is currently submitted or approved');
      }

      // Update report metadata
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          projectId: dto.projectId,
          weekStartDate: new Date(dto.weekStartDate),
          weekEndDate: new Date(dto.weekEndDate),
        },
      });
    } else {
      // Create new draft report
      report = await this.prisma.report.create({
        data: {
          userId,
          projectId: dto.projectId,
          weekStartDate: new Date(dto.weekStartDate),
          weekEndDate: new Date(dto.weekEndDate),
          status: ReportStatus.DRAFT,
          currentVersionNumber: 1,
        },
      });
    }

    // Upsert version 1 or the current draft version
    const versionNum = report.currentVersionNumber;
    const existingVersion = await this.prisma.reportVersion.findUnique({
      where: {
        reportId_versionNumber: {
          reportId: report.id,
          versionNumber: versionNum,
        },
      },
    });

    let currentVersion;
    if (existingVersion) {
      // Delete existing tasks to replace with draft's tasks
      await this.prisma.taskItem.deleteMany({
        where: { reportVersionId: existingVersion.id },
      });

      currentVersion = await this.prisma.reportVersion.update({
        where: { id: existingVersion.id },
        data: {
          tasksPlannedNextWeek: dto.tasksPlannedNextWeek || null,
          blockers: dto.blockers || [],
          keyBlockerIndex: dto.keyBlockerIndex ?? null,
          achievements: dto.achievements || [],
          keyAchievementIndex: dto.keyAchievementIndex ?? null,
          devHours: dto.devHours || 0,
          testingHours: dto.testingHours || 0,
          meetingHours: dto.meetingHours || 0,
          docHours: dto.docHours || 0,
          notes: dto.notes || null,
        },
      });
    } else {
      currentVersion = await this.prisma.reportVersion.create({
        data: {
          reportId: report.id,
          versionNumber: versionNum,
          tasksPlannedNextWeek: dto.tasksPlannedNextWeek || null,
          blockers: dto.blockers || [],
          keyBlockerIndex: dto.keyBlockerIndex ?? null,
          achievements: dto.achievements || [],
          keyAchievementIndex: dto.keyAchievementIndex ?? null,
          devHours: dto.devHours || 0,
          testingHours: dto.testingHours || 0,
          meetingHours: dto.meetingHours || 0,
          docHours: dto.docHours || 0,
          notes: dto.notes || null,
        },
      });
    }

    // Create tasks
    if (dto.tasks && dto.tasks.length > 0) {
      await this.prisma.taskItem.createMany({
        data: dto.tasks.map((t) => ({
          reportVersionId: currentVersion.id,
          taskName: t.taskName,
          priority: t.priority,
          status: t.status,
          plannedPercentage: t.plannedPercentage || 0,
          actualPercentage: t.actualPercentage || 0,
          plannedHours: t.plannedHours || 0,
          spentHours: t.spentHours || 0,
          deliverableOutput: t.deliverableOutput || null,
        })),
      });
    }

    return this.findOne(report.id);
  }

  async submitReport(userId: string, reportId: string, dto?: SubmitReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { tasks: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    if (report.userId !== userId) {
      throw new ForbiddenException('Cannot submit another member’s report');
    }

    if (report.status === ReportStatus.APPROVED) {
      throw new BadRequestException('This report is already approved');
    }

    // Determine target version number:
    // If coming from NEEDS_CORRECTION, we increment version number to keep past version immutable!
    let nextVersionNumber = report.currentVersionNumber;
    if (report.status === ReportStatus.NEEDS_CORRECTION) {
      nextVersionNumber += 1;
    }

    // Create the new snapshot version
    const payload = dto || {
      projectId: report.projectId,
      weekStartDate: report.weekStartDate.toISOString(),
      weekEndDate: report.weekEndDate.toISOString(),
      tasksPlannedNextWeek: report.versions[0]?.tasksPlannedNextWeek,
      blockers: report.versions[0]?.blockers || [],
      keyBlockerIndex: report.versions[0]?.keyBlockerIndex,
      achievements: report.versions[0]?.achievements || [],
      keyAchievementIndex: report.versions[0]?.keyAchievementIndex,
      devHours: report.versions[0]?.devHours || 0,
      testingHours: report.versions[0]?.testingHours || 0,
      meetingHours: report.versions[0]?.meetingHours || 0,
      docHours: report.versions[0]?.docHours || 0,
      notes: report.versions[0]?.notes,
      tasks: report.versions[0]?.tasks || [],
    };

    // Update Report metadata and transition status
    await this.prisma.report.update({
      where: { id: report.id },
      data: {
        projectId: payload.projectId,
        weekStartDate: new Date(payload.weekStartDate),
        weekEndDate: new Date(payload.weekEndDate),
        status: ReportStatus.SUBMITTED,
        currentVersionNumber: nextVersionNumber,
      },
    });

    // Create or update version snapshot
    const existingVer = await this.prisma.reportVersion.findUnique({
      where: {
        reportId_versionNumber: {
          reportId: report.id,
          versionNumber: nextVersionNumber,
        },
      },
    });

    let newVersion;
    if (existingVer) {
      await this.prisma.taskItem.deleteMany({
        where: { reportVersionId: existingVer.id },
      });

      newVersion = await this.prisma.reportVersion.update({
        where: { id: existingVer.id },
        data: {
          tasksPlannedNextWeek: payload.tasksPlannedNextWeek || null,
          blockers: payload.blockers || [],
          keyBlockerIndex: payload.keyBlockerIndex ?? null,
          achievements: payload.achievements || [],
          keyAchievementIndex: payload.keyAchievementIndex ?? null,
          devHours: payload.devHours || 0,
          testingHours: payload.testingHours || 0,
          meetingHours: payload.meetingHours || 0,
          docHours: payload.docHours || 0,
          notes: payload.notes || null,
          submittedAt: new Date(),
        },
      });
    } else {
      newVersion = await this.prisma.reportVersion.create({
        data: {
          reportId: report.id,
          versionNumber: nextVersionNumber,
          tasksPlannedNextWeek: payload.tasksPlannedNextWeek || null,
          blockers: payload.blockers || [],
          keyBlockerIndex: payload.keyBlockerIndex ?? null,
          achievements: payload.achievements || [],
          keyAchievementIndex: payload.keyAchievementIndex ?? null,
          devHours: payload.devHours || 0,
          testingHours: payload.testingHours || 0,
          meetingHours: payload.meetingHours || 0,
          docHours: payload.docHours || 0,
          notes: payload.notes || null,
          submittedAt: new Date(),
        },
      });
    }

    // Insert task items
    if (payload.tasks && payload.tasks.length > 0) {
      await this.prisma.taskItem.createMany({
        data: payload.tasks.map((t: any) => ({
          reportVersionId: newVersion.id,
          taskName: t.taskName,
          priority: t.priority,
          status: t.status,
          plannedPercentage: t.plannedPercentage || 0,
          actualPercentage: t.actualPercentage || 0,
          plannedHours: t.plannedHours || 0,
          spentHours: t.spentHours || 0,
          deliverableOutput: t.deliverableOutput || null,
        })),
      });
    }

    return this.findOne(report.id);
  }

  async getMyHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { weekStartDate: 'desc' },
        include: {
          project: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: { tasks: true },
          },
          reviewComments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { reviewer: { select: { fullName: true } } },
          },
        },
      }),
      this.prisma.report.count({ where: { userId } }),
    ]);

    return {
      reports: reports.map((r) => {
        const latestVersion = r.versions[0];
        const totalHours =
          (latestVersion?.devHours || 0) +
          (latestVersion?.testingHours || 0) +
          (latestVersion?.meetingHours || 0) +
          (latestVersion?.docHours || 0);

        const tasks = latestVersion?.tasks || [];
        const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
        const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

        return {
          id: r.id,
          weekStartDate: r.weekStartDate,
          weekEndDate: r.weekEndDate,
          status: r.status,
          currentVersionNumber: r.currentVersionNumber,
          project: r.project,
          totalHours,
          taskCount: tasks.length,
          completionRate,
          latestComment: r.reviewComments[0] || null,
          updatedAt: r.updatedAt,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(query: {
    weekStartDate?: string;
    userId?: string;
    projectId?: string;
    status?: ReportStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 30;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.userId && query.userId !== 'undefined' && query.userId !== 'ALL') {
      where.userId = query.userId;
    }
    if (query.projectId && query.projectId !== 'undefined' && query.projectId !== 'ALL') {
      where.projectId = query.projectId;
    }
    if (query.status && (query.status as string) !== 'undefined' && (query.status as string) !== 'ALL') {
      where.status = query.status;
    }
    if (
      query.weekStartDate &&
      query.weekStartDate !== 'undefined' &&
      query.weekStartDate !== 'ALL' &&
      !isNaN(Date.parse(query.weekStartDate))
    ) {
      const target = new Date(query.weekStartDate);
      where.weekStartDate = {
        gte: new Date(target.setHours(0, 0, 0, 0)),
        lte: new Date(target.setHours(23, 59, 59, 999)),
      };
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { weekStartDate: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarColor: true,
              title: true,
            },
          },
          project: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: { tasks: true },
          },
          reviewComments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { reviewer: { select: { fullName: true } } },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports: reports.map((r) => {
        const latestVersion = r.versions[0];
        const totalHours =
          (latestVersion?.devHours || 0) +
          (latestVersion?.testingHours || 0) +
          (latestVersion?.meetingHours || 0) +
          (latestVersion?.docHours || 0);

        const tasks = latestVersion?.tasks || [];
        const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
        const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

        return {
          id: r.id,
          weekStartDate: r.weekStartDate,
          weekEndDate: r.weekEndDate,
          status: r.status,
          currentVersionNumber: r.currentVersionNumber,
          user: r.user,
          project: r.project,
          totalHours,
          taskCount: tasks.length,
          completionRate,
          blockerCount: latestVersion?.blockers.length || 0,
          hasKeyBlocker: latestVersion?.keyBlockerIndex !== null && latestVersion?.keyBlockerIndex !== undefined,
          latestComment: r.reviewComments[0] || null,
          updatedAt: r.updatedAt,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarColor: true,
            title: true,
            department: true,
          },
        },
        project: true,
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: {
            tasks: true,
            reviewComments: {
              include: { reviewer: { select: { fullName: true, title: true } } },
            },
          },
        },
        reviewComments: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: { select: { fullName: true, title: true, avatarColor: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    return report;
  }

  async reviewReport(id: string, reviewerId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${id} not found`);
    }

    if (report.status !== ReportStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot review report in status ${report.status}. Report must be SUBMITTED.`,
      );
    }

    const latestVersion = report.versions[0];
    const isApprove = dto.action === ReviewActionType.APPROVE;
    const targetStatus = isApprove ? ReportStatus.APPROVED : ReportStatus.NEEDS_CORRECTION;
    const actionType = isApprove ? ReviewAction.APPROVED : ReviewAction.REQUESTED_CHANGES;

    // Transition status and create review comment
    const [, reviewComment] = await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id },
        data: { status: targetStatus },
      }),
      this.prisma.reviewComment.create({
        data: {
          reportId: id,
          reportVersionId: latestVersion ? latestVersion.id : null,
          reviewerId,
          comment: dto.comment || (isApprove ? 'Report approved with no changes.' : 'Changes requested.'),
          action: actionType,
        },
      }),
    ]);

    return {
      success: true,
      newStatus: targetStatus,
      reviewComment,
    };
  }
}
