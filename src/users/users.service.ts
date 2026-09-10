import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, ReportStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const AVATAR_COLORS = ['#ec3013', '#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#16a34a'];

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

  async createUser(dto: {
    fullName: string;
    email: string;
    password: string;
    role?: Role;
    department?: string;
    title?: string;
  }) {
    if (!dto.email || !dto.password || !dto.fullName) {
      throw new BadRequestException('Full name, email, and password are required');
    }

    if (dto.fullName.trim().length < 2) {
      throw new BadRequestException('Full name must be at least 2 characters long');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email.trim())) {
      throw new BadRequestException('Please provide a valid work email address');
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const role = dto.role || Role.TEAM_MEMBER;
    const title =
      dto.title ||
      (role === Role.ADMIN
        ? 'System Administrator'
        : role === Role.MANAGER
        ? 'Engineering Manager'
        : 'Software Engineer');

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        fullName: dto.fullName.trim(),
        role,
        department: dto.department || 'Engineering',
        title,
        avatarColor: randomColor,
        active: true,
      },
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
      },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Protection rule: Root/Initial Admin account CANNOT be deleted
    if (user.id === 'u-admin-root' || user.email === 'admin@cadence.com') {
      throw new BadRequestException('The primary system administrator account is protected and cannot be deleted.');
    }

    // Protection rule: Cannot delete the last remaining admin
    if (user.role === Role.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last remaining Administrator in the system.');
      }
    }

    // Cascade delete user data
    await this.prisma.reviewComment.deleteMany({ where: { reviewerId: id } });
    await this.prisma.report.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `User ${user.fullName} deleted successfully.` };
  }

  async changePassword(currentUserId: string, targetUserId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long.');
    }

    const currentUser = await this.prisma.user.findUnique({ where: { id: currentUserId } });
    if (!currentUser || currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only Administrators are permitted to reset user passwords.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const isTargetRootAdmin =
      targetUser.id === 'u-admin-root' || targetUser.email.toLowerCase() === 'admin@cadence.com';
    const isCurrentRootAdmin =
      currentUser.id === 'u-admin-root' || currentUser.email.toLowerCase() === 'admin@cadence.com';

    // Root Admin can change anyone's password
    // Other Admins CANNOT change the primary Root Admin's password
    if (isTargetRootAdmin && !isCurrentRootAdmin) {
      throw new ForbiddenException(
        'The primary system administrator password can only be modified by the root administrator.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    return { success: true, message: `Password updated successfully for ${targetUser.fullName}.` };
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; title?: string; department?: string; avatarColor?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName ? data.fullName.trim() : undefined,
        title: data.title ? data.title.trim() : undefined,
        department: data.department ? data.department.trim() : undefined,
        avatarColor: data.avatarColor || undefined,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        department: true,
        title: true,
        avatarColor: true,
        active: true,
      },
    });
  }

  async changeOwnPassword(userId: string, currentPass: string, newPass: string) {
    if (!currentPass || !newPass) {
      throw new BadRequestException('Current password and new password are required.');
    }
    if (newPass.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long.');
    }
    if (currentPass === newPass) {
      throw new BadRequestException('New password cannot be the same as your current password.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isValid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Your password has been changed successfully.' };
  }

  async updateRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if ((user.id === 'u-admin-root' || user.email === 'admin@cadence.com') && role !== Role.ADMIN) {
      throw new BadRequestException('The primary system administrator account role cannot be changed.');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role,
        title:
          role === Role.ADMIN
            ? 'System Administrator'
            : role === Role.MANAGER
            ? 'Engineering Manager'
            : 'Software Engineer',
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

    // Protection rule: Root admin cannot be deactivated
    if (user.id === 'u-admin-root' || user.email === 'admin@cadence.com') {
      throw new BadRequestException('The primary system administrator account cannot be deactivated.');
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
