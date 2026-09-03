import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database via Prisma.');
    } catch (error) {
      // Fail loudly. Swallowing this with a warning meant the API booted and
      // reported healthy while every request 500'd on first query — the worst
      // possible failure mode for an emergency-services platform. If the
      // database is unreachable at startup, the process must not come up.
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to PostgreSQL: ${detail}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log(' Disconnected from PostgreSQL database.');
  }
}
