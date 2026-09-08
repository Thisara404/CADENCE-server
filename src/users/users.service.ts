import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, ReportStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        title: true,
        avatarColor: true,
        active: true,
        createdAt: true,
        _count: {
          select: { reports: true },
        },
      },
    });

    return users.map((u) => ({
      ...u,
      reportCount: u._count.reports,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { weekStartDate: 'desc' },
          include: {
            project: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { tasks: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const ownReports = user.reports;
    const submittedOrApproved = ownReports.filter((r) => r.status !== ReportStatus.DRAFT);
    const onTimeRate = ownReports.length
      ? Math.round((submittedOrApproved.length / ownReports.length) * 100)
      : 0;

    let totalTasks = 0;
    let completedTasks = 0;
    let totalHours = 0;
    const allBlockers: any[] = [];

    ownReports.forEach((r) => {
      const ver = r.versions[0];
      if (ver) {
        totalHours += (ver.devHours || 0) + (ver.testingHours || 0) + (ver.meetingHours || 0) + (ver.docHours || 0);
        const tasks = ver.tasks || [];
        totalTasks += tasks.length;
        completedTasks += tasks.filter((t) => t.status === 'DONE').length;

        (ver.blockers || []).forEach((b, idx) => {
          allBlockers.push({
            text: b,
            isKey: ver.keyBlockerIndex === idx,
            weekStartDate: r.weekStartDate,
            projectName: r.project.name,
          });
        });
      }
    });

    const avgCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        title: user.title,
        avatarColor: user.avatarColor,
        active: user.active,
      },
      stats: {
        totalReports: ownReports.length,
        onTimeRate,
        avgCompletion,
        totalHours,
      },
      blockers: allBlockers.slice(0, 10),
      reports: ownReports.map((r) => {
        const ver = r.versions[0];
        const tasks = ver?.tasks || [];
        const done = tasks.filter((t) => t.status === 'DONE').length;
        const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        const hours =
          (ver?.devHours || 0) + (ver?.testingHours || 0) + (ver?.meetingHours || 0) + (ver?.docHours || 0);

        return {
          id: r.id,
          weekStartDate: r.weekStartDate,
          weekEndDate: r.weekEndDate,
          project: r.project,
          status: r.status,
          currentVersionNumber: r.currentVersionNumber,
          completion,
          hours,
        };
      }),
    };
  }

  async updateRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role,
        title: role === Role.MANAGER ? 'Engineering Manager' : 'Software Engineer',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        title: true,
        active: true,
      },
    });
  }

  async toggleStatus(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { active: !user.active },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        active: true,
      },
    });
  }
}
