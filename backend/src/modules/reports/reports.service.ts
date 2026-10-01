import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CertificationStatus,
  CertificationStatusService,
} from '../../shared/domain/certification-status.service';
import {
  CoverageService,
} from '../../shared/domain/coverage.service';
import { ReportResult } from '../../shared/reporting/csv';
import { QueryReportDto } from './dto/query-report.dto';

export type ReportKey =
  | 'certifications'
  | 'expirations'
  | 'roadmap'
  | 'vendors';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROADMAP_CLOSED: RoadmapStatus[] = [
  RoadmapStatus.COMPLETED,
  RoadmapStatus.CANCELLED,
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: CertificationStatusService,
    private readonly coverageService: CoverageService,
    private readonly config: ConfigService,
  ) {}

  generate(key: ReportKey, filters: QueryReportDto): Promise<ReportResult> {
    switch (key) {
      case 'certifications':
        return this.certificationsReport(filters);
      case 'expirations':
        return this.expirationsReport(filters);
      case 'roadmap':
        return this.roadmapReport(filters);
      case 'vendors':
        return this.vendorsReport(filters);
    }
  }

  // -------------------------------------------------------------------------

  private async certificationsReport(
    filters: QueryReportDto,
  ): Promise<ReportResult> {
    const records = await this.prisma.professionalCertification.findMany({
      where: this.certFilter(filters),
      select: {
        certificateNumber: true,
        obtainedAt: true,
        expiresAt: true,
        professional: { select: { name: true, email: true } },
        certification: {
          select: {
            name: true,
            code: true,
            level: true,
            vendor: { select: { name: true } },
            technology: { select: { name: true } },
          },
        },
      },
      orderBy: [{ professional: { name: 'asc' } }, { expiresAt: 'asc' }],
    });

    const rows = records.map((record) => {
      const status = this.statusService.resolve(record.expiresAt);
      return {
        professional: record.professional.name,
        email: record.professional.email,
        certification: record.certification.name,
        code: record.certification.code ?? '',
        vendor: record.certification.vendor.name,
        technology: record.certification.technology?.name ?? '',
        level: record.certification.level ?? '',
        obtainedAt: this.iso(record.obtainedAt),
        expiresAt: this.iso(record.expiresAt),
        status,
        daysRemaining: record.expiresAt
          ? this.statusService.daysRemaining(record.expiresAt)
          : null,
        certificateNumber: record.certificateNumber ?? '',
      };
    });

    const summary: Record<string, number> = { total: rows.length };
    for (const row of rows) {
      summary[row.status] = (summary[row.status] ?? 0) + 1;
    }

    return {
      key: 'certifications',
      title: 'Relatório de certificações',
      columns: [
        { key: 'professional', label: 'Profissional' },
        { key: 'email', label: 'E-mail' },
        { key: 'certification', label: 'Certificação' },
        { key: 'code', label: 'Código' },
        { key: 'vendor', label: 'Fabricante' },
        { key: 'technology', label: 'Tecnologia' },
        { key: 'level', label: 'Nível' },
        { key: 'obtainedAt', label: 'Obtida em' },
        { key: 'expiresAt', label: 'Expira em' },
        { key: 'status', label: 'Status' },
        { key: 'daysRemaining', label: 'Dias restantes' },
        { key: 'certificateNumber', label: 'Nº do certificado' },
      ],
      rows,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  private async expirationsReport(
    filters: QueryReportDto,
  ): Promise<ReportResult> {
    const records = await this.prisma.professionalCertification.findMany({
      where: { ...this.certFilter(filters), expiresAt: { not: null } },
      select: {
        certificateNumber: true,
        expiresAt: true,
        professional: { select: { name: true } },
        certification: {
          select: { name: true, vendor: { select: { name: true } } },
        },
      },
    });

    const bucketOf = (days: number): string => {
      if (days < 0) return 'Vencida';
      if (days <= 30) return 'Até 30 dias';
      if (days <= 60) return '31 a 60 dias';
      if (days <= 90) return '61 a 90 dias';
      return 'Acima de 90 dias';
    };

    const rows = records
      .map((record) => {
        const days = this.statusService.daysRemaining(record.expiresAt as Date);
        return {
          professional: record.professional.name,
          certification: record.certification.name,
          vendor: record.certification.vendor.name,
          expiresAt: this.iso(record.expiresAt),
          daysRemaining: days,
          bucket: bucketOf(days),
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const summary: Record<string, number> = { total: rows.length };
    for (const row of rows) {
      summary[row.bucket] = (summary[row.bucket] ?? 0) + 1;
    }

    return {
      key: 'expirations',
      title: 'Relatório de vencimentos',
      columns: [
        { key: 'professional', label: 'Profissional' },
        { key: 'certification', label: 'Certificação' },
        { key: 'vendor', label: 'Fabricante' },
        { key: 'expiresAt', label: 'Expira em' },
        { key: 'daysRemaining', label: 'Dias restantes' },
        { key: 'bucket', label: 'Faixa' },
      ],
      rows,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  private async roadmapReport(filters: QueryReportDto): Promise<ReportResult> {
    const items = await this.prisma.roadmapItem.findMany({
      where: this.roadmapFilter(filters),
      select: {
        title: true,
        type: true,
        priority: true,
        status: true,
        startDate: true,
        dueDate: true,
        professional: { select: { name: true } },
        technology: {
          select: { name: true, vendor: { select: { name: true } } },
        },
        certification: {
          select: { name: true, vendor: { select: { name: true } } },
        },
      },
    });

    const today = this.today();

    const situationOf = (item: (typeof items)[number]): string => {
      if (item.status === RoadmapStatus.COMPLETED) return 'Concluído';
      if (item.status === RoadmapStatus.CANCELLED) return 'Cancelado';
      if (item.dueDate) {
        const days = Math.round(
          (this.dateOnly(item.dueDate).getTime() - today.getTime()) / MS_PER_DAY,
        );
        if (days < 0) return 'Atrasado';
        if (days <= 30) return 'Próximo';
      }
      return 'Backlog';
    };

    const rows = items
      .map((item) => {
        const daysToDue = item.dueDate
          ? Math.round(
              (this.dateOnly(item.dueDate).getTime() - today.getTime()) / MS_PER_DAY,
            )
          : null;
        return {
          professional: item.professional.name,
          title: item.title,
          type: item.type,
          priority: item.priority,
          status: item.status,
          vendor:
            item.technology?.vendor.name ?? item.certification?.vendor.name ?? '',
          technology: item.technology?.name ?? item.certification?.name ?? '',
          startDate: this.iso(item.startDate),
          dueDate: this.iso(item.dueDate),
          daysToDue,
          situation: situationOf(item),
        };
      })
      .sort((a, b) => (a.daysToDue ?? 99999) - (b.daysToDue ?? 99999));

    const summary: Record<string, number> = { total: rows.length };
    for (const row of rows) {
      summary[row.situation] = (summary[row.situation] ?? 0) + 1;
    }

    return {
      key: 'roadmap',
      title: 'Relatório de roadmap',
      columns: [
        { key: 'professional', label: 'Profissional' },
        { key: 'title', label: 'Objetivo' },
        { key: 'type', label: 'Tipo' },
        { key: 'priority', label: 'Prioridade' },
        { key: 'status', label: 'Status' },
        { key: 'vendor', label: 'Fabricante' },
        { key: 'technology', label: 'Tecnologia' },
        { key: 'startDate', label: 'Início' },
        { key: 'dueDate', label: 'Prazo' },
        { key: 'daysToDue', label: 'Dias até o prazo' },
        { key: 'situation', label: 'Situação' },
      ],
      rows,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  private async vendorsReport(filters: QueryReportDto): Promise<ReportResult> {
    const [vendors, certRecords, activeProfessionals] = await Promise.all([
      this.prisma.vendor.findMany({
        where: filters.vendorId ? { id: filters.vendorId } : undefined,
        select: {
          id: true,
          name: true,
          partnershipStatus: true,
          partnershipLevel: true,
          _count: { select: { technologies: true, certifications: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.professionalCertification.findMany({
        where: {
          certification: filters.technologyId
            ? { technologyId: filters.technologyId }
            : undefined,
        },
        select: {
          professionalId: true,
          expiresAt: true,
          professional: { select: { active: true } },
          certification: { select: { vendorId: true } },
        },
      }),
      this.prisma.professional.count({ where: { active: true } }),
    ]);

    const coveredByVendor = new Map<string, Set<string>>();
    for (const record of certRecords) {
      if (!record.professional.active) continue;
      const status = this.statusService.resolve(record.expiresAt);
      if (status === CertificationStatus.EXPIRED) continue;
      const set = coveredByVendor.get(record.certification.vendorId) ?? new Set();
      set.add(record.professionalId);
      coveredByVendor.set(record.certification.vendorId, set);
    }

    const rows = vendors.map((vendor) => {
      const covered = coveredByVendor.get(vendor.id)?.size ?? 0;
      return {
        vendor: vendor.name,
        partnershipStatus: vendor.partnershipStatus,
        partnershipLevel: vendor.partnershipLevel ?? '',
        technologies: vendor._count.technologies,
        certifications: vendor._count.certifications,
        certifiedProfessionals: covered,
        coverage: this.coverageService.calculate(covered, activeProfessionals),
      };
    });

    return {
      key: 'vendors',
      title: 'Relatório por fabricante',
      columns: [
        { key: 'vendor', label: 'Fabricante' },
        { key: 'partnershipStatus', label: 'Parceria' },
        { key: 'partnershipLevel', label: 'Nível' },
        { key: 'technologies', label: 'Tecnologias' },
        { key: 'certifications', label: 'Certificações' },
        { key: 'certifiedProfessionals', label: 'Profissionais certificados' },
        { key: 'coverage', label: 'Cobertura (%)' },
      ],
      rows,
      summary: { total: rows.length },
      generatedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------

  private certFilter(filters: QueryReportDto): Prisma.ProfessionalCertificationWhereInput {
    const where: Prisma.ProfessionalCertificationWhereInput = {};
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.vendorId || filters.technologyId) {
      where.certification = {
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.technologyId ? { technologyId: filters.technologyId } : {}),
      };
    }
    return where;
  }

  private roadmapFilter(filters: QueryReportDto): Prisma.RoadmapItemWhereInput {
    const where: Prisma.RoadmapItemWhereInput = {};
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.technologyId) where.technologyId = filters.technologyId;
    if (filters.vendorId) {
      where.OR = [
        { technology: { vendorId: filters.vendorId } },
        { certification: { vendorId: filters.vendorId } },
      ];
    }
    return where;
  }

  private iso(date: Date | null): string {
    return date ? new Date(date).toISOString().slice(0, 10) : '';
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
