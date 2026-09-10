import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus, Role } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(weekStartDate?: string) {
    // Determine active members count
    const totalMembers = await this.prisma.user.count({
      where: { role: Role.TEAM_MEMBER, active: true },
    });

    // Get reports for week or all recent reports
    const where: any = {};
    if (
      weekStartDate &&
      weekStartDate !== 'undefined' &&
      weekStartDate !== 'ALL' &&
      !isNaN(Date.parse(weekStartDate))
    ) {
      const target = new Date(weekStartDate);
      where.weekStartDate = {
        gte: new Date(target.setHours(0, 0, 0, 0)),
        lte: new Date(target.setHours(23, 59, 59, 999)),
      };
    }

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    const submittedCount = reports.filter((r) => r.status !== ReportStatus.DRAFT).length;
    const pendingReviewCount = reports.filter((r) => r.status === ReportStatus.SUBMITTED).length;
    const needsCorrectionCount = reports.filter((r) => r.status === ReportStatus.NEEDS_CORRECTION).length;
    const approvedCount = reports.filter((r) => r.status === ReportStatus.APPROVED).length;

    const complianceRate = totalMembers > 0 ? Math.round((submittedCount / totalMembers) * 100) : 0;

    // Count open blockers in latest version of reports
    let openBlockers = 0;
    reports.forEach((r) => {
      const ver = r.versions[0];
      if (ver && ver.blockers) {
        openBlockers += ver.blockers.length;
      }
    });

    return {
      totalMembers,
      totalSubmitted: submittedCount,
      pendingReviews: pendingReviewCount,
      needsCorrectionCount,
      approvedCount,
      complianceRate,
      openBlockers,
    };
  }

  async getCharts(weekStartDate?: string, projectId?: string, memberId?: string) {
    const filterWeek = weekStartDate && weekStartDate !== 'ALL' && weekStartDate !== 'undefined' ? weekStartDate : undefined;
    const filterProject = projectId && projectId !== 'ALL' && projectId !== 'undefined' ? projectId : undefined;
    const filterMember = memberId && memberId !== 'ALL' && memberId !== 'undefined' ? memberId : undefined;

    // Base filter for non-draft reports
    const baseWhere: any = {
      status: { not: ReportStatus.DRAFT },
    };
    if (filterProject) {
      baseWhere.projectId = filterProject;
    }
    if (filterMember) {
      baseWhere.userId = filterMember;
    }

    // 1. Velocity Trend: Filter by project, member, and show progression up to selected week
    const velocityWhere: any = { ...baseWhere };
    if (filterWeek && !isNaN(Date.parse(filterWeek))) {
      const target = new Date(filterWeek);
      velocityWhere.weekStartDate = {
        lte: new Date(new Date(target).setHours(23, 59, 59, 999)),
      };
    }

    const velocityReports = await this.prisma.report.findMany({
      where: velocityWhere,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { tasks: true },
        },
        user: true,
        project: true,
      },
      orderBy: { weekStartDate: 'asc' },
    });

    // Group reports by canonical week Monday string to prevent splitting the same work week
    const getWeekMonday = (d: Date): string => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      return date.toISOString().split('T')[0];
    };

    const getIsoWeekLabel = (d: Date): string => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      return `W${weekNum}`;
    };

    const weekMap = new Map<string, { label: string; reps: any[] }>();
    velocityReports.forEach((r) => {
      const key = getWeekMonday(r.weekStartDate);
      const label = getIsoWeekLabel(r.weekStartDate);
      if (!weekMap.has(key)) {
        weekMap.set(key, { label, reps: [] });
      }
      weekMap.get(key)!.reps.push(r);
    });

    const velocityTrend = Array.from(weekMap.entries()).map(([weekDate, entry]) => {
      let planned = 0;
      let completed = 0;
      entry.reps.forEach((r) => {
        const tasks = r.versions[0]?.tasks || [];
        planned += tasks.length;
        completed += tasks.filter((t) => t.status === 'DONE').length;
      });
      return {
        weekDate,
        weekLabel: entry.label,
        plannedTasks: planned,
        completedTasks: completed,
      };
    });

    // 2. Status by member (filtered by member, project, and week)
    const memberWhere: any = { role: Role.TEAM_MEMBER, active: true };
    if (filterMember) {
      memberWhere.id = filterMember;
    }

    const members = await this.prisma.user.findMany({
      where: memberWhere,
      include: {
        reports: {
          where: {
            ...(filterProject ? { projectId: filterProject } : {}),
            ...(filterWeek && !isNaN(Date.parse(filterWeek))
              ? {
                  weekStartDate: {
                    gte: new Date(new Date(filterWeek).setHours(0, 0, 0, 0)),
                    lte: new Date(new Date(filterWeek).setHours(23, 59, 59, 999)),
                  },
                }
              : {}),
          },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { tasks: true },
            },
          },
        },
      },
    });

    const statusByMember = members.map((m) => {
      const memberReports = m.reports;
      const approved = memberReports.filter((r) => r.status === ReportStatus.APPROVED).length;
      const submitted = memberReports.filter((r) => r.status === ReportStatus.SUBMITTED).length;
      const needsCorrection = memberReports.filter((r) => r.status === ReportStatus.NEEDS_CORRECTION).length;
      const draft = memberReports.filter((r) => r.status === ReportStatus.DRAFT).length;
      const total = memberReports.length || 1;

      // Completion rate average
      let totalTasks = 0;
      let doneTasks = 0;
      memberReports.forEach((r) => {
        const tasks = r.versions[0]?.tasks || [];
        totalTasks += tasks.length;
        doneTasks += tasks.filter((t) => t.status === 'DONE').length;
      });

      return {
        id: m.id,
        name: m.fullName,
        email: m.email,
        avatarColor: m.avatarColor,
        reportCount: memberReports.length,
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        approved,
        submitted,
        needsCorrection,
        draft,
        approvedPct: Math.round((approved / total) * 100),
        submittedPct: Math.round((submitted / total) * 100),
        needsCorrectionPct: Math.round((needsCorrection / total) * 100),
        draftPct: Math.round((draft / total) * 100),
      };
    });

    // 3. Project Workload Distribution (filtered by week, project, and member)
    const projectWhere: any = {};
    if (filterProject) {
      projectWhere.id = filterProject;
    }

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      include: {
        reports: {
          where: {
            status: { not: ReportStatus.DRAFT },
            ...(filterMember ? { userId: filterMember } : {}),
            ...(filterWeek && !isNaN(Date.parse(filterWeek))
              ? {
                  weekStartDate: {
                    gte: new Date(new Date(filterWeek).setHours(0, 0, 0, 0)),
                    lte: new Date(new Date(filterWeek).setHours(23, 59, 59, 999)),
                  },
                }
              : {}),
          },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const projectWorkload = projects.map((p) => {
      let hours = 0;
      p.reports.forEach((r) => {
        const ver = r.versions[0];
        if (ver) {
          hours += (ver.devHours || 0) + (ver.testingHours || 0) + (ver.meetingHours || 0) + (ver.docHours || 0);
        }
      });
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        hours,
        reportCount: p.reports.length,
      };
    });

    // 4. Time Breakdown across filtered reports
    const breakdownWhere: any = { ...baseWhere };
    if (filterWeek && !isNaN(Date.parse(filterWeek))) {
      const target = new Date(filterWeek);
      breakdownWhere.weekStartDate = {
        gte: new Date(new Date(target).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(target).setHours(23, 59, 59, 999)),
      };
    }

    const filteredReports = await this.prisma.report.findMany({
      where: breakdownWhere,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    const timeTotals = {
      development: 0,
      testing: 0,
      meetings: 0,
      documentation: 0,
    };

    filteredReports.forEach((r) => {
      const ver = r.versions[0];
      if (ver) {
        timeTotals.development += ver.devHours || 0;
        timeTotals.testing += ver.testingHours || 0;
        timeTotals.meetings += ver.meetingHours || 0;
        timeTotals.documentation += ver.docHours || 0;
      }
    });

    const totalHours =
      timeTotals.development + timeTotals.testing + timeTotals.meetings + timeTotals.documentation;

    const timeBreakdown = [
      {
        name: 'Development',
        hours: timeTotals.development,
        percentage: totalHours > 0 ? Math.round((timeTotals.development / totalHours) * 100) : 0,
        color: '#ec3013',
      },
      {
        name: 'Testing',
        hours: timeTotals.testing,
        percentage: totalHours > 0 ? Math.round((timeTotals.testing / totalHours) * 100) : 0,
        color: '#2563eb',
      },
      {
        name: 'Meetings',
        hours: timeTotals.meetings,
        percentage: totalHours > 0 ? Math.round((timeTotals.meetings / totalHours) * 100) : 0,
        color: '#d97706',
      },
      {
        name: 'Documentation',
        hours: timeTotals.documentation,
        percentage: totalHours > 0 ? Math.round((timeTotals.documentation / totalHours) * 100) : 0,
        color: '#059669',
      },
    ];

    return {
      velocityTrend,
      statusByMember,
      projectWorkload,
      timeBreakdown,
    };
  }

  async getBlockersAndAchievements(weekStartDate?: string) {
    const where: any = {
      status: { not: ReportStatus.DRAFT },
    };
    if (
      weekStartDate &&
      weekStartDate !== 'undefined' &&
      weekStartDate !== 'ALL' &&
      !isNaN(Date.parse(weekStartDate))
    ) {
      const target = new Date(weekStartDate);
      where.weekStartDate = {
        gte: new Date(target.setHours(0, 0, 0, 0)),
        lte: new Date(target.setHours(23, 59, 59, 999)),
      };
    }

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, avatarColor: true } },
        project: { select: { id: true, name: true, code: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    return reports.map((r) => {
      const ver = r.versions[0];
      return {
        reportId: r.id,
        user: r.user,
        project: r.project,
        status: r.status,
        blockers: ver?.blockers || [],
        keyBlockerIndex: ver?.keyBlockerIndex ?? null,
        achievements: ver?.achievements || [],
        keyAchievementIndex: ver?.keyAchievementIndex ?? null,
      };
    });
  }
}
