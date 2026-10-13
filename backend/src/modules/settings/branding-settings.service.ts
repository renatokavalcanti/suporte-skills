import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

const BRANDING_SETTING_KEY = 'branding';

export interface ResolvedBranding {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoDataUrl: string | null;
  contactLine: string;
  website: string;
}

/**
 * Identidade visual (D-030): nome/cores/logo usados no Relatorio do Cliente.
 * Editavel pela interface (ADMIN), guardada em `app_settings` (key `branding`).
 * Nao ha segredos aqui.
 */
@Injectable()
export class BrandingSettingsService implements OnModuleInit {
  private readonly logger = new Logger(BrandingSettingsService.name);
  private cache: Partial<ResolvedBranding> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    void this.reload();
  }

  async ensureLoaded(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: BRANDING_SETTING_KEY },
      });
      this.cache =
        row && row.value && typeof row.value === 'object'
          ? (row.value as unknown as Partial<ResolvedBranding>)
          : {};
    } catch (error) {
      this.logger.warn(`Falha ao carregar a identidade visual: ${String(error)}`);
      this.cache = {};
    }
  }

  getResolved(): ResolvedBranding {
    return {
      companyName: this.cache.companyName?.trim() || 'Suporte Informática',
      primaryColor: this.cache.primaryColor?.trim() || '#1d4ed8',
      secondaryColor: this.cache.secondaryColor?.trim() || '#f3f4f6',
      logoDataUrl: this.cache.logoDataUrl?.trim() || null,
      contactLine: this.cache.contactLine?.trim() || '',
      website: this.cache.website?.trim() || '',
    };
  }

  getView(): ResolvedBranding {
    return this.getResolved();
  }

  async update(
    dto: UpdateBrandingSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<ResolvedBranding> {
    const before = this.getResolved();
    const next: Partial<ResolvedBranding> = { ...this.cache };

    if (dto.companyName !== undefined) next.companyName = dto.companyName.trim();
    if (dto.primaryColor !== undefined)
      next.primaryColor = dto.primaryColor.trim();
    if (dto.secondaryColor !== undefined)
      next.secondaryColor = dto.secondaryColor.trim();
    if (dto.contactLine !== undefined) next.contactLine = dto.contactLine.trim();
    if (dto.website !== undefined) next.website = dto.website.trim();
    if (dto.clearLogo) next.logoDataUrl = undefined;
    else if (dto.logoDataUrl !== undefined && dto.logoDataUrl !== '') {
      next.logoDataUrl = dto.logoDataUrl.trim();
    }

    await this.prisma.appSetting.upsert({
      where: { key: BRANDING_SETTING_KEY },
      create: {
        key: BRANDING_SETTING_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    this.cache = next;

    await this.audit.record({
      actorId: actor.id,
      entity: 'app_settings',
      entityId: BRANDING_SETTING_KEY,
      action: 'UPDATE',
      before: { ...before, logoDataUrl: before.logoDataUrl ? '[logo]' : null },
      after: {
        ...this.getResolved(),
        logoDataUrl: this.getResolved().logoDataUrl ? '[logo]' : null,
      },
    });

    return this.getResolved();
  }
}
