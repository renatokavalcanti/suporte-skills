import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { AuditModule } from './shared/audit/audit.module';
import { DomainModule } from './shared/domain/domain.module';
import { AuthModule } from './modules/auth/auth.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { NewsModule } from './modules/news/news.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TechnologiesModule } from './modules/technologies/technologies.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuditModule,
    DomainModule,
    AuthModule,
    HealthModule,
    ProfessionalsModule,
    VendorsModule,
    TechnologiesModule,
    CertificationsModule,
    RoadmapModule,
    DashboardModule,
    ReportsModule,
    ImportsModule,
    NewsModule,
    ReleasesModule,
    SettingsModule,
  ],
  providers: [
    // Autenticacao global: rotas so sao abertas se marcadas com @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Autorizacao por papel: aplicada quando a rota declara @Roles(...).
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
