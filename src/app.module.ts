import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    ReportsModule,
    DashboardModule,
    UsersModule,
    AiModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
