import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'Cadence API Backend',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/login',
        projects: '/api/projects',
        reports: '/api/reports',
        users: '/api/users',
        dashboard: '/api/dashboard/summary',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async getHealth() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: 'ok',
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
