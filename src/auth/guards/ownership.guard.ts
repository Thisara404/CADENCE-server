import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const reportId = request.params.id;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Managers and Admins can view any report
    if (user.role === Role.MANAGER || user.role === Role.ADMIN) {
      return true;
    }

    if (!reportId) {
      return true;
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { userId: true },
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    if (report.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to access another member’s report');
    }

    return true;
  }
}
