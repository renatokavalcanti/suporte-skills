import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoadmapPriority, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CertificationStatus,
  CertificationStatusService,
} from '../../shared/domain/certification-status.service';
import { CoverageService } from '../../shared/domain/coverage.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROADMAP_CLOSED: RoadmapStatus[] = [
  RoadmapStatus.COMPLETED,
  RoadmapStatus.CANCELLED,
];

export interface DashboardCards {
  professionals: number;
  certificationsAssigned: number;
  expiring: number;
  expired: number;
  openRoadmap: number;
  overdueRoadmap: number;
}

export interface ExpirationItem {
  professionalId: string;
  professionalName: string;
  certificationName: string;
  vendorName: string;
  expiresAt: string;
  daysRemaining: number;
  status: CertificationStatus;
}

export interface RoadmapBucketItem {
  id: string;
  title: string;
  professionalName: string;
  dueDate: string | null;
  daysToDue: number | null;
  priority: RoadmapPriority;
  status: RoadmapStatus;
  isOverdue: boolean;
}

export interface RoadmapBuckets {
  overdue: { count: number; items: RoadmapBucketItem[] };
  next30: { count: number; items: RoadmapBucketItem[] };
  days31to90: { count: number; items: RoadmapBucketItem[] };
  next6Months: { count: number; items: RoadmapBucketItem[] };
}

export interface AlertItem {
  type: string;
  severity: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
}

export interface CoverageItem {
  technologyId: string;
  technologyName: string;
  vendorName: string;
  coveredProfessionals: number;
  totalProfessionals: number;
  coverage: number;
}

export interface DashboardOverview {
  generatedAt: string;
  expiringThresholdDays: number;
  cards: DashboardCards;
  certificationStatus: Record<CertificationStatus, number>;
  upcomingExpirations: ExpirationItem[];
  roadmap: RoadmapBuckets;
  alerts: AlertItem[];
  coverage: CoverageItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: CertificationStatusService,
    private readonly coverageService: CoverageService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const today = this.today();

    const [activeProfessionals, certRecords, roadmapItems, technologies] =
      await Promise.all([
        this.prisma.professional.count({ where: { active: true } }),
        this.prisma.professionalCertification.findMany({
          // Indicadores de certificacao consideram apenas profissionais ativos,
          // para nao divergir do calculo de cobertura (D-010).
          where: { professional: { active: true } },
          select: {
            expiresAt: true,
            professionalId: true,
            professional: { select: { name: true, active: true } },
            certification: {
              select: {
                id: true,
                name: true,
                vendor: { select: { name: true } },
                technology: {
                  select: { id: true, name: true, vendor: { select: { name: true } } },
                },
              },
            },
          },
        }),
        this.prisma.roadmapItem.findMany({
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            professional: { select: { name: true } },
          },
        }),
        this.prisma.technology.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            vendor: { select: { name: true } },
          },
        }),
      ]);

    const certificationStatus: Record<CertificationStatus, number> = {
      [CertificationStatus.ACTIVE]: 0,
      [CertificationStatus.EXPIRING]: 0,
      [CertificationStatus.EXPIRED]: 0,
      [CertificationStatus.NO_EXPIRATION]: 0,
    };

    const upcoming: ExpirationItem[] = [];
    const coveredByTechnology = new Map<string, Set<string>>();

    for (const record of certRecords) {
      const status = this.statusService.resolve(record.expiresAt);
      certificationStatus[status] += 1;

      // "Proximos vencimentos" = certificacoes dentro da janela de atencao.
      if (status === CertificationStatus.EXPIRING && record.expiresAt) {
        upcoming.push({
          professionalId: record.professionalId,
          professionalName: record.professional.name,
          certificationName: record.certification.name,
          vendorName: record.certification.vendor.name,
          expiresAt: record.expiresAt.toISOString().slice(0, 10),
          daysRemaining: this.statusService.daysRemaining(record.expiresAt),
          status,
        });
      }

      const technology = record.certification.technology;
      if (technology && status !== CertificationStatus.EXPIRED) {
        const set = coveredByTechnology.get(technology.id) ?? new Set<string>();
        set.add(record.professionalId);
        coveredByTechnology.set(technology.id, set);
      }
    }

    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const openRoadmap = roadmapItems.filter(
      (item) => !ROADMAP_CLOSED.includes(item.status),
    ).length;

    const buckets = this.buildRoadmapBuckets(roadmapItems, today);

    const coverage: CoverageItem[] = technologies
      .map((technology) => {
        const covered = coveredByTechnology.get(technology.id)?.size ?? 0;
        return {
          technologyId: technology.id,
          technologyName: technology.name,
          vendorName: technology.vendor.name,
          coveredProfessionals: covered,
          totalProfessionals: activeProfessionals,
          coverage: this.coverageService.calculate(covered, activeProfessionals),
        };
      })
      .sort((a, b) => a.coverage - b.coverage || a.technologyName.localeCompare(b.technologyName));

    const alerts = this.buildAlerts({
      certificationStatus,
      expiredCount: certificationStatus[CertificationStatus.EXPIRED],
      expiringCount: certificationStatus[CertificationStatus.EXPIRING],
      expiringDays: this.statusService.expiringThresholdDays,
      overdueRoadmap: buckets.overdue.count,
      dueSoonRoadmap: buckets.next30.count,
      zeroCoverage: coverage.filter((item) => item.coveredProfessionals === 0),
    });

    return {
      generatedAt: new Date().toISOString(),
      expiringThresholdDays: this.statusService.expiringThresholdDays,
      cards: {
        professionals: activeProfessionals,
        certificationsAssigned: certRecords.length,
        expiring: certificationStatus[CertificationStatus.EXPIRING],
        expired: certificationStatus[CertificationStatus.EXPIRED],
        openRoadmap,
        overdueRoadmap: buckets.overdue.count,
      },
      certificationStatus,
      upcomingExpirations: upcoming.slice(0, 10),
      roadmap: buckets,
      alerts,
      coverage,
    };
  }

  private buildRoadmapBuckets(
    items: {
      id: string;
      title: string;
      status: RoadmapStatus;
      priority: RoadmapPriority;
      dueDate: Date | null;
      professional: { name: string };
    }[],
    today: Date,
  ): RoadmapBuckets {
    const open = items.filter((item) => !ROADMAP_CLOSED.includes(item.status));

    const toBucketItem = (item: (typeof open)[number]): RoadmapBucketItem => {
      const daysToDue = item.dueDate
        ? Math.round((this.dateOnly(item.dueDate).getTime() - today.getTime()) / MS_PER_DAY)
        : null;
      return {
        id: item.id,
        title: item.title,
        professionalName: item.professional.name,
        dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : null,
        daysToDue,
        priority: item.priority,
        status: item.status,
        isOverdue: daysToDue !== null && daysToDue < 0,
      };
    };

    const withDue = open
      .map(toBucketItem)
      .filter((item) => item.daysToDue !== null);

    const byRange = (from: number, to: number) =>
      withDue.filter(
        (item) => (item.daysToDue as number) >= from && (item.daysToDue as number) <= to,
      );

    const sortByDue = (list: RoadmapBucketItem[]) =>
      [...list].sort((a, b) => (a.daysToDue as number) - (b.daysToDue as number));

    const overdue = sortByDue(withDue.filter((item) => (item.daysToDue as number) < 0));
    const next30 = sortByDue(byRange(0, 30));
    const days31to90 = sortByDue(byRange(31, 90));
    const next6Months = sortByDue(byRange(91, 180));

    return {
      overdue: { count: overdue.length, items: overdue.slice(0, 5) },
      next30: { count: next30.length, items: next30.slice(0, 5) },
      days31to90: { count: days31to90.length, items: days31to90.slice(0, 5) },
      next6Months: { count: next6Months.length, items: next6Months.slice(0, 5) },
    };
  }

  private buildAlerts(input: {
    certificationStatus: Record<CertificationStatus, number>;
    expiredCount: number;
    expiringCount: number;
    expiringDays: number;
    overdueRoadmap: number;
    dueSoonRoadmap: number;
    zeroCoverage: CoverageItem[];
  }): AlertItem[] {
    const alerts: AlertItem[] = [];

    if (input.expiredCount > 0) {
      alerts.push({
        type: 'CERTIFICATION_EXPIRED',
        severity: 'danger',
        title: 'Certificações vencidas',
        description: `${input.expiredCount} certificação(ões) já venceram e precisam de renovação.`,
        count: input.expiredCount,
      });
    }
    if (input.expiringCount > 0) {
      alerts.push({
        type: 'CERTIFICATION_EXPIRING',
        severity: 'warning',
        title: `Certificações vencendo em até ${input.expiringDays} dias`,
        description: `${input.expiringCount} certificação(ões) estão próximas do vencimento.`,
        count: input.expiringCount,
      });
    }
    if (input.overdueRoadmap > 0) {
      alerts.push({
        type: 'ROADMAP_OVERDUE',
        severity: 'danger',
        title: 'Objetivos de roadmap atrasados',
        description: `${input.overdueRoadmap} objetivo(s) passaram do prazo sem conclusão.`,
        count: input.overdueRoadmap,
      });
    }
    if (input.dueSoonRoadmap > 0) {
      alerts.push({
        type: 'ROADMAP_DUE_SOON',
        severity: 'warning',
        title: 'Objetivos vencendo em 30 dias',
        description: `${input.dueSoonRoadmap} objetivo(s) têm prazo nos próximos 30 dias.`,
        count: input.dueSoonRoadmap,
      });
    }
    if (input.zeroCoverage.length > 0) {
      const names = input.zeroCoverage.slice(0, 3).map((item) => item.technologyName);
      alerts.push({
        type: 'TECHNOLOGY_NO_COVERAGE',
        severity: 'warning',
        title: 'Tecnologias sem cobertura',
        description: `${input.zeroCoverage.length} tecnologia(s) ativas sem nenhum profissional com certificação em vigor (ex.: ${names.join(', ')}).`,
        count: input.zeroCoverage.length,
      });
    }

    return alerts;
  }

  private today(): Date {
    const timezone =
      this.config.get<string>('business.timezone') ?? 'America/Sao_Paulo';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');
    return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  }

  private dateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
}
