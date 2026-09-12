import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.error(
        'CRITICAL: DATABASE_URL environment variable is missing! Please configure DATABASE_URL in your Vercel Project Settings -> Environment Variables.',
      );
    }
    try {
      await this.$connect();
      this.logger.log('Database connected successfully.');
    } catch (err: any) {
      this.logger.error(`Prisma connection error: ${err?.message || err}`);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
