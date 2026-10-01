import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum CertificationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  NO_EXPIRATION = 'NO_EXPIRATION',
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calcula o status de validade de uma certificacao em runtime.
 * O status NAO e persistido (regra do produto).
 *
 * - EXPIRED:       expires_at < hoje
 * - EXPIRING:      hoje <= expires_at <= hoje + N dias (N configuravel)
 * - ACTIVE:        expires_at > hoje + N dias
 * - NO_EXPIRATION: expires_at ausente
 */
@Injectable()
export class CertificationStatusService {
  constructor(private readonly config: ConfigService) {}

  get expiringThresholdDays(): number {
    return this.config.get<number>('business.certExpiringDays') ?? 90;
  }

  private get timezone(): string {
    return this.config.get<string>('business.timezone') ?? 'America/Sao_Paulo';
  }

  resolve(
    expiresAt: Date | null | undefined,
    reference: Date = new Date(),
  ): CertificationStatus {
    if (!expiresAt) {
      return CertificationStatus.NO_EXPIRATION;
    }

    const remaining = this.daysRemaining(expiresAt, reference);

    if (remaining < 0) {
      return CertificationStatus.EXPIRED;
    }
    if (remaining <= this.expiringThresholdDays) {
      return CertificationStatus.EXPIRING;
    }
    return CertificationStatus.ACTIVE;
  }

  /** Dias restantes ate o vencimento (negativo se ja venceu). */
  daysRemaining(
    expiresAt: Date,
    reference: Date = new Date(),
  ): number {
    const today = this.dateOnly(reference, this.timezone);
    const expiry = this.dateOnly(expiresAt, 'UTC');
    return Math.round((expiry.getTime() - today.getTime()) / MS_PER_DAY);
  }

  /** Retorna a data (meia-noite UTC) correspondente ao dia atual no fuso informado. */
  private dateOnly(date: Date, timezone: string): Date {
    if (timezone === 'UTC') {
      return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const get = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');

    return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  }
}
