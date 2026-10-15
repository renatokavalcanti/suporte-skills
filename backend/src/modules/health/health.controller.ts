import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../shared/decorators/public.decorator';
import type { AppEnvironment } from '../../config/configuration';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  async check(): Promise<{
    status: string;
    database: string;
    environment: AppEnvironment;
    timestamp: string;
  }> {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      // Ambiente (PRD/HML/DEV) exibido na interface — D-038.
      environment: this.config.get<AppEnvironment>('environment') ?? 'DEV',
      timestamp: new Date().toISOString(),
    };
  }
}
