import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AttachmentStorageService } from '../../shared/storage/attachment-storage.service';
import {
  assertPdfUpload,
  sanitizeAttachmentName,
} from '../../shared/storage/pdf-attachment';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { assertProfessionalAccess } from '../../shared/common/access';
import {
  CertificationStatus,
  CertificationStatusService,
} from '../../shared/domain/certification-status.service';
import { CreateProfessionalCertificationDto } from './dto/create-professional-certification.dto';
import { UpdateProfessionalCertificationDto } from './dto/update-professional-certification.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RECORD_SELECT = {
  id: true,
  professionalId: true,
  certificationId: true,
  certificateNumber: true,
  obtainedAt: true,
  expiresAt: true,
  proofUrl: true,
  attachmentFile: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  attachmentUploadedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  certification: {
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
      officialUrl: true,
      validityMonths: true,
      catalogStatus: true,
      vendor: { select: { id: true, name: true } },
      technology: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ProfessionalCertificationSelect;

type RecordRow = Prisma.ProfessionalCertificationGetPayload<{
  select: typeof RECORD_SELECT;
}>;

export type ProfessionalCertificationView = Omit<RecordRow, 'attachmentFile'> & {
  /** Indica se ha anexo sem expor o nome interno no disco (D-025). */
  hasAttachment: boolean;
  status: CertificationStatus;
  daysRemaining: number | null;
};

export interface CertificationAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
}

export interface TechnologyCoverageItem {
  technologyId: string | null;
  name: string;
  vendorName: string | null;
  category: string | null;
  certifications: number;
  status: CertificationStatus;
}

@Injectable()
export class ProfessionalCertificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusService: CertificationStatusService,
    private readonly storage: AttachmentStorageService,
  ) {}

  async list(
    professionalId: string,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalCertificationView[]> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertProfessionalExists(professionalId);

    const rows = await this.prisma.professionalCertification.findMany({
      where: { professionalId },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }],
      select: RECORD_SELECT,
    });

    return rows.map((row) => this.toView(row));
  }

  async add(
    professionalId: string,
    dto: CreateProfessionalCertificationDto,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalCertificationView> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertProfessionalExists(professionalId);

    const certification = await this.prisma.certification.findUnique({
      where: { id: dto.certificationId },
      select: { id: true, name: true },
    });
    if (!certification) {
      throw new BadRequestException('Certificacao informada nao existe');
    }

    this.assertDatesCoherent(dto.obtainedAt, dto.expiresAt);

    const openRecord = await this.findOpenRecord(
      professionalId,
      dto.certificationId,
    );

    // Renovacao (D-004/D-015): a nova linha passa a valer e a anterior e
    // encerrada na vespera da nova obtencao, preservando o historico.
    let superseded: { id: string; expiresAt: Date | null } | null = null;

    if (openRecord && !dto.renew) {
      throw new ConflictException(
        'Ja existe um registro em vigor desta certificacao para o profissional',
      );
    }

    if (openRecord) {
      if (!dto.obtainedAt) {
        throw new BadRequestException(
          'Informe a data de obtencao para renovar a certificacao',
        );
      }
      const obtainedAt = new Date(dto.obtainedAt);
      if (openRecord.obtainedAt && obtainedAt <= openRecord.obtainedAt) {
        throw new BadRequestException(
          'A data de obtencao da renovacao deve ser posterior a do registro atual',
        );
      }
      superseded = {
        id: openRecord.id,
        expiresAt: new Date(obtainedAt.getTime() - MS_PER_DAY),
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (superseded) {
        await tx.professionalCertification.update({
          where: { id: superseded.id },
          data: { expiresAt: superseded.expiresAt },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            entity: 'professional_certifications',
            entityId: superseded.id,
            action: 'UPDATE',
            before: {
              professionalId,
              certificationId: dto.certificationId,
              expiresAt: this.toIso(openRecord?.expiresAt ?? null),
            },
            after: {
              professionalId,
              certificationId: dto.certificationId,
              expiresAt: this.toIso(superseded.expiresAt),
              supersededBy: 'renewal',
            },
          },
          tx,
        );
      }

      const row = await tx.professionalCertification.create({
        data: {
          professionalId,
          certificationId: dto.certificationId,
          obtainedAt: dto.obtainedAt ? new Date(dto.obtainedAt) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          certificateNumber: dto.certificateNumber?.trim() || null,
          proofUrl: dto.proofUrl?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        select: RECORD_SELECT,
      });

      await this.audit.record(
        {
          actorId: actor.id,
          entity: 'professional_certifications',
          entityId: row.id,
          action: 'CREATE',
          after: this.auditPayload(row),
        },
        tx,
      );

      return row;
    });

    return this.toView(created);
  }

  async update(
    professionalId: string,
    recordId: string,
    dto: UpdateProfessionalCertificationDto,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalCertificationView> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRecord(professionalId, recordId);

    // `undefined` mantem o valor atual; `null` limpa de verdade.
    this.assertDatesCoherent(
      dto.obtainedAt !== undefined
        ? dto.obtainedAt
        : this.toIso(existing.obtainedAt),
      dto.expiresAt !== undefined
        ? dto.expiresAt
        : this.toIso(existing.expiresAt),
    );

    const datesChanged =
      dto.obtainedAt !== undefined || dto.expiresAt !== undefined;

    if (dto.certificationId !== undefined || datesChanged) {
      await this.assertNoOpenDuplicate(
        professionalId,
        dto.certificationId ?? existing.certificationId,
        recordId,
      );
    }

    const data: Prisma.ProfessionalCertificationUpdateInput = {};
    if (dto.certificationId !== undefined)
      data.certification = { connect: { id: dto.certificationId } };
    if (dto.obtainedAt !== undefined)
      data.obtainedAt = dto.obtainedAt ? new Date(dto.obtainedAt) : null;
    if (dto.expiresAt !== undefined)
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.certificateNumber !== undefined)
      data.certificateNumber = dto.certificateNumber?.trim() || null;
    if (dto.proofUrl !== undefined)
      data.proofUrl = dto.proofUrl?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    const updated = await this.prisma.professionalCertification.update({
      where: { id: recordId },
      data,
      select: RECORD_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'professional_certifications',
      entityId: recordId,
      action: 'UPDATE',
      before: this.auditPayload(existing),
      after: this.auditPayload(updated),
    });

    return this.toView(updated);
  }

  async remove(
    professionalId: string,
    recordId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRecord(professionalId, recordId);

    await this.prisma.$transaction(async (tx) => {
      await tx.professionalCertification.delete({ where: { id: recordId } });
      await this.audit.record(
        {
          actorId: actor.id,
          entity: 'professional_certifications',
          entityId: recordId,
          action: 'DELETE',
          before: this.auditPayload(existing),
        },
        tx,
      );
    });

    // Anexo (D-025): o arquivo no disco nao sobrevive ao vinculo.
    if (existing.attachmentFile) {
      await this.storage.remove(existing.attachmentFile);
    }
  }

  // --- Anexo do comprovante (D-025) ---------------------------------------

  async uploadAttachment(
    professionalId: string,
    recordId: string,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalCertificationView> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRecord(professionalId, recordId);
    assertPdfUpload(file, this.storage.maxFileBytes);

    const storedName = await this.storage.save(file!.buffer, '.pdf');
    let updated: RecordRow;
    try {
      updated = await this.prisma.professionalCertification.update({
        where: { id: recordId },
        data: {
          attachmentFile: storedName,
          attachmentName: sanitizeAttachmentName(file!.originalname),
          attachmentMime: 'application/pdf',
          attachmentSize: file!.size,
          attachmentUploadedAt: new Date(),
        },
        select: RECORD_SELECT,
      });
    } catch (error) {
      await this.storage.remove(storedName);
      throw error;
    }

    // Substituicao: o arquivo anterior deixa de existir.
    if (existing.attachmentFile && existing.attachmentFile !== storedName) {
      await this.storage.remove(existing.attachmentFile);
    }

    await this.audit.record({
      actorId: actor.id,
      entity: 'professional_certifications',
      entityId: recordId,
      action: 'UPDATE',
      before: { attachmentName: existing.attachmentName },
      after: { attachmentName: updated.attachmentName, replaced: Boolean(existing.attachmentFile) },
    });

    return this.toView(updated);
  }

  async getAttachment(
    professionalId: string,
    recordId: string,
    actor: AuthenticatedUser,
  ): Promise<CertificationAttachment> {
    assertProfessionalAccess(professionalId, actor);
    const record = await this.findRecord(professionalId, recordId);

    if (!record.attachmentFile) {
      throw new NotFoundException('Esta certificacao nao possui anexo');
    }
    if (!(await this.storage.exists(record.attachmentFile))) {
      throw new NotFoundException('Anexo nao encontrado no servidor');
    }

    return {
      path: this.storage.pathOf(record.attachmentFile),
      name: record.attachmentName ?? 'certificado.pdf',
      mime: record.attachmentMime ?? 'application/pdf',
      size: record.attachmentSize ?? 0,
    };
  }

  async removeAttachment(
    professionalId: string,
    recordId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRecord(professionalId, recordId);

    if (!existing.attachmentFile) {
      throw new NotFoundException('Esta certificacao nao possui anexo');
    }

    await this.prisma.professionalCertification.update({
      where: { id: recordId },
      data: {
        attachmentFile: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        attachmentUploadedAt: null,
      },
    });
    await this.storage.remove(existing.attachmentFile);

    await this.audit.record({
      actorId: actor.id,
      entity: 'professional_certifications',
      entityId: recordId,
      action: 'UPDATE',
      before: { attachmentName: existing.attachmentName },
      after: { attachmentName: null },
    });
  }

  /** Tecnologias derivadas das certificacoes do profissional. */
  async listTechnologies(
    professionalId: string,
    actor: AuthenticatedUser,
  ): Promise<TechnologyCoverageItem[]> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertProfessionalExists(professionalId);

    const records = await this.prisma.professionalCertification.findMany({
      where: { professionalId },
      select: {
        expiresAt: true,
        certification: {
          select: {
            technology: {
              select: {
                id: true,
                name: true,
                category: true,
                vendor: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const map = new Map<string, TechnologyCoverageItem>();
    for (const record of records) {
      const technology = record.certification.technology;
      const key = technology?.id ?? '__sem-tecnologia__';
      const status = this.statusService.resolve(record.expiresAt);
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          technologyId: technology?.id ?? null,
          name: technology?.name ?? 'Sem tecnologia vinculada',
          vendorName: technology?.vendor.name ?? null,
          category: technology?.category ?? null,
          certifications: 1,
          status,
        });
      } else {
        current.certifications += 1;
        current.status = this.bestStatus(current.status, status);
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listHistory(
    professionalId: string,
    actor: AuthenticatedUser,
  ) {
    assertProfessionalAccess(professionalId, actor);
    await this.assertProfessionalExists(professionalId);

    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'professionals', entityId: professionalId },
          {
            entity: 'professional_certifications',
            after: { path: ['professionalId'], equals: professionalId },
          },
          {
            entity: 'professional_certifications',
            before: { path: ['professionalId'], equals: professionalId },
          },
          {
            entity: 'roadmap_items',
            after: { path: ['professionalId'], equals: professionalId },
          },
          {
            entity: 'roadmap_items',
            before: { path: ['professionalId'], equals: professionalId },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });
  }

  // -------------------------------------------------------------------------

  private async assertProfessionalExists(professionalId: string): Promise<void> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true },
    });
    if (!professional) {
      throw new NotFoundException('Profissional nao encontrado');
    }
  }

  private async findRecord(
    professionalId: string,
    recordId: string,
  ): Promise<RecordRow> {
    const record = await this.prisma.professionalCertification.findFirst({
      where: { id: recordId, professionalId },
      select: RECORD_SELECT,
    });
    if (!record) {
      throw new NotFoundException(
        'Certificacao do profissional nao encontrada',
      );
    }
    return record;
  }

  private async assertNoOpenDuplicate(
    professionalId: string,
    certificationId: string,
    excludeId?: string,
  ): Promise<void> {
    const open = await this.findOpenRecord(
      professionalId,
      certificationId,
      excludeId,
    );
    if (open) {
      throw new ConflictException(
        'Ja existe um registro em vigor desta certificacao para o profissional',
      );
    }
  }

  /** Primeiro registro em vigor (nao vencido) da certificacao, se houver. */
  private async findOpenRecord(
    professionalId: string,
    certificationId: string,
    excludeId?: string,
  ): Promise<{
    id: string;
    obtainedAt: Date | null;
    expiresAt: Date | null;
  } | null> {
    const records = await this.prisma.professionalCertification.findMany({
      where: {
        professionalId,
        certificationId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, obtainedAt: true, expiresAt: true },
      orderBy: [{ expiresAt: { sort: 'desc', nulls: 'first' } }],
    });

    return (
      records.find(
        (record) =>
          record.expiresAt === null ||
          this.statusService.resolve(record.expiresAt) !==
            CertificationStatus.EXPIRED,
      ) ?? null
    );
  }

  private assertDatesCoherent(
    obtainedAt?: string | null,
    expiresAt?: string | null,
  ): void {
    if (obtainedAt && expiresAt && new Date(expiresAt) < new Date(obtainedAt)) {
      throw new BadRequestException(
        'A data de expiracao nao pode ser anterior a data de obtencao',
      );
    }
  }

  private toView(row: RecordRow): ProfessionalCertificationView {
    const { attachmentFile, ...rest } = row;
    return {
      ...rest,
      hasAttachment: attachmentFile !== null,
      status: this.statusService.resolve(row.expiresAt),
      daysRemaining: row.expiresAt
        ? this.statusService.daysRemaining(row.expiresAt)
        : null,
    };
  }

  private toIso(date: Date | null): string | null {
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private auditPayload(row: RecordRow) {
    return {
      professionalId: row.professionalId,
      certificationId: row.certificationId,
      obtainedAt: this.toIso(row.obtainedAt),
      expiresAt: this.toIso(row.expiresAt),
      certificateNumber: row.certificateNumber,
    } satisfies Prisma.InputJsonValue;
  }

  private bestStatus(
    current: CertificationStatus,
    next: CertificationStatus,
  ): CertificationStatus {
    const rank: Record<CertificationStatus, number> = {
      [CertificationStatus.ACTIVE]: 0,
      [CertificationStatus.NO_EXPIRATION]: 1,
      [CertificationStatus.EXPIRING]: 2,
      [CertificationStatus.EXPIRED]: 3,
    };
    return rank[next] < rank[current] ? next : current;
  }
}
