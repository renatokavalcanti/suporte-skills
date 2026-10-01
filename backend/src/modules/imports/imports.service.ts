import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ProfessionalType, Role, Seniority } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import {
  CertificationStatus,
  CertificationStatusService,
} from '../../shared/domain/certification-status.service';
import {
  normalizeHeader,
  normalizeName,
  parseCsv,
  parseDate,
} from '../../shared/importing/csv-parser';

export type ImportType = 'professionals' | 'certifications';

export interface ImportRowResult {
  line: number;
  status: 'valid' | 'invalid';
  errors: string[];
  data: Record<string, string>;
}

export interface ImportPreview {
  type: ImportType;
  total: number;
  valid: number;
  invalid: number;
  columns: { key: string; label: string }[];
  rows: ImportRowResult[];
}

export interface ImportCommitResult {
  type: ImportType;
  total: number;
  imported: number;
  skipped: number;
  errors: { line: number; errors: string[] }[];
}

interface ImportOutcome {
  imported: number;
  errors: { line: number; errors: string[] }[];
}

interface FieldSpec {
  key: string;
  label: string;
  aliases: string[];
  required?: boolean;
}

const MAX_ROWS = 1000;

const SPECS: Record<ImportType, FieldSpec[]> = {
  professionals: [
    { key: 'name', label: 'Nome', aliases: ['name', 'nome'], required: true },
    { key: 'email', label: 'E-mail', aliases: ['email', 'e_mail', 'mail'], required: true },
    { key: 'position', label: 'Cargo', aliases: ['position', 'cargo', 'funcao'] },
    { key: 'professional_type', label: 'Tipo', aliases: ['professional_type', 'tipo', 'tipo_profissional'] },
    { key: 'seniority', label: 'Senioridade', aliases: ['seniority', 'senioridade', 'nivel'] },
  ],
  certifications: [
    { key: 'professional_email', label: 'E-mail do profissional', aliases: ['professional_email', 'email_profissional', 'email', 'e_mail'], required: true },
    { key: 'vendor', label: 'Fabricante', aliases: ['vendor', 'fabricante'], required: true },
    { key: 'certification', label: 'Certificação', aliases: ['certification', 'certificacao', 'certificado'], required: true },
    { key: 'obtained_at', label: 'Obtida em', aliases: ['obtained_at', 'data_obtencao', 'obtido_em', 'obtida_em'] },
    { key: 'expires_at', label: 'Expira em', aliases: ['expires_at', 'data_expiracao', 'expira_em'] },
    { key: 'certificate_number', label: 'Nº do certificado', aliases: ['certificate_number', 'numero_certificado', 'numero'] },
  ],
};

const emailRegex = /^\S+@\S+\.\S+$/;

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusService: CertificationStatusService,
  ) {}

  async preview(type: ImportType, content: string): Promise<ImportPreview> {
    const { rows, columns } = await this.validate(type, content);
    return {
      type,
      total: rows.length,
      valid: rows.filter((row) => row.status === 'valid').length,
      invalid: rows.filter((row) => row.status === 'invalid').length,
      columns: columns.map((spec) => ({ key: spec.key, label: spec.label })),
      rows,
    };
  }

  async commit(
    type: ImportType,
    content: string,
    actor: AuthenticatedUser,
  ): Promise<ImportCommitResult> {
    const { rows } = await this.validate(type, content);
    const validRows = rows.filter((row) => row.status === 'valid');

    const outcome =
      type === 'professionals'
        ? await this.importProfessionals(validRows, actor)
        : await this.importCertifications(validRows, actor);

    const errors = [
      ...rows
        .filter((row) => row.status === 'invalid')
        .map((row) => ({ line: row.line, errors: row.errors })),
      // Falhas ocorridas na gravacao (ex.: referencia removida entre a previa
      // e a confirmacao) tambem sao reportadas, nunca ignoradas em silencio.
      ...outcome.errors,
    ].sort((a, b) => a.line - b.line);

    return {
      type,
      total: rows.length,
      imported: outcome.imported,
      skipped: rows.length - outcome.imported,
      errors,
    };
  }

  // -------------------------------------------------------------------------

  private async validate(
    type: ImportType,
    content: string,
  ): Promise<{ rows: ImportRowResult[]; columns: FieldSpec[] }> {
    if (!content || content.trim() === '') {
      throw new BadRequestException('Arquivo vazio');
    }

    const matrix = parseCsv(content);
    if (matrix.length < 2) {
      throw new BadRequestException(
        'Arquivo deve conter cabecalho e ao menos uma linha',
      );
    }

    const specs = SPECS[type];
    const header = matrix[0].map((cell) => normalizeHeader(cell));
    const headerIndex = this.mapHeader(header, specs);

    const missing = specs
      .filter((spec) => spec.required && headerIndex[spec.key] === undefined)
      .map((spec) => spec.label);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Colunas obrigatorias ausentes: ${missing.join(', ')}`,
      );
    }

    const dataRows = matrix.slice(1);
    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException(
        `O arquivo excede o limite de ${MAX_ROWS} linhas`,
      );
    }

    const rows =
      type === 'professionals'
        ? await this.validateProfessionals(dataRows, headerIndex)
        : await this.validateCertifications(dataRows, headerIndex);

    return { rows, columns: specs };
  }

  private mapHeader(
    header: string[],
    specs: FieldSpec[],
  ): Record<string, number> {
    const index: Record<string, number> = {};
    for (const spec of specs) {
      const position = header.findIndex((cell) => spec.aliases.includes(cell));
      if (position >= 0) index[spec.key] = position;
    }
    return index;
  }

  private cell(
    row: string[],
    headerIndex: Record<string, number>,
    key: string,
  ): string {
    const position = headerIndex[key];
    if (position === undefined) return '';
    return (row[position] ?? '').trim();
  }

  private async validateProfessionals(
    dataRows: string[][],
    headerIndex: Record<string, number>,
  ): Promise<ImportRowResult[]> {
    const existing = await this.prisma.professional.findMany({
      select: { email: true },
    });
    const existingEmails = new Set(
      existing.map((item) => item.email.toLowerCase()),
    );

    const typeValues = this.enumMap(Object.values(ProfessionalType));
    const seniorityValues = this.enumMap(Object.values(Seniority));
    const seenEmails = new Set<string>();

    return dataRows.map((row, index) => {
      const line = index + 2;
      const errors: string[] = [];

      const name = this.cell(row, headerIndex, 'name');
      const email = this.cell(row, headerIndex, 'email').toLowerCase();
      const position = this.cell(row, headerIndex, 'position');
      const rawType = this.cell(row, headerIndex, 'professional_type');
      const rawSeniority = this.cell(row, headerIndex, 'seniority');

      if (!name) errors.push('Nome obrigatorio');
      if (!email) errors.push('E-mail obrigatorio');
      else if (!emailRegex.test(email)) errors.push('E-mail invalido');
      else if (existingEmails.has(email)) errors.push('E-mail ja cadastrado');
      else if (seenEmails.has(email)) errors.push('E-mail repetido no arquivo');

      let professionalType: ProfessionalType | null = null;
      if (rawType) {
        professionalType = typeValues[normalizeName(rawType)] ?? null;
        if (!professionalType) errors.push(`Tipo invalido: ${rawType}`);
      }

      let seniority: Seniority | null = null;
      if (rawSeniority) {
        seniority = seniorityValues[normalizeName(rawSeniority)] ?? null;
        if (!seniority) errors.push(`Senioridade invalida: ${rawSeniority}`);
      }

      if (email && emailRegex.test(email)) seenEmails.add(email);

      return {
        line,
        status: errors.length === 0 ? 'valid' : 'invalid',
        errors,
        data: {
          name,
          email,
          position,
          professional_type: professionalType ?? rawType,
          seniority: seniority ?? rawSeniority,
        },
      };
    });
  }

  private async validateCertifications(
    dataRows: string[][],
    headerIndex: Record<string, number>,
  ): Promise<ImportRowResult[]> {
    const [professionals, vendors, certifications, existingLinks] =
      await Promise.all([
        this.prisma.professional.findMany({
          select: { id: true, email: true },
        }),
        this.prisma.vendor.findMany({ select: { id: true, name: true } }),
        this.prisma.certification.findMany({
          select: { id: true, name: true, vendorId: true },
        }),
        this.prisma.professionalCertification.findMany({
          select: { professionalId: true, certificationId: true, expiresAt: true },
        }),
      ]);

    const professionalByEmail = new Map(
      professionals.map((item) => [item.email.toLowerCase(), item.id]),
    );
    const vendorByName = new Map(
      vendors.map((item) => [normalizeName(item.name), item.id]),
    );
    const certByVendorAndName = new Map(
      certifications.map((item) => [
        `${item.vendorId}::${normalizeName(item.name)}`,
        item.id,
      ]),
    );

    const openLinks = new Set(
      existingLinks
        .filter(
          (link) =>
            this.statusService.resolve(link.expiresAt) !==
            CertificationStatus.EXPIRED,
        )
        .map((link) => `${link.professionalId}::${link.certificationId}`),
    );
    const seenLinks = new Set<string>();

    return dataRows.map((row, index) => {
      const line = index + 2;
      const errors: string[] = [];

      const email = this.cell(row, headerIndex, 'professional_email').toLowerCase();
      const vendorName = this.cell(row, headerIndex, 'vendor');
      const certName = this.cell(row, headerIndex, 'certification');
      const obtainedRaw = this.cell(row, headerIndex, 'obtained_at');
      const expiresRaw = this.cell(row, headerIndex, 'expires_at');
      const certificateNumber = this.cell(row, headerIndex, 'certificate_number');

      const professionalId = professionalByEmail.get(email);
      if (!email) errors.push('E-mail do profissional obrigatorio');
      else if (!professionalId)
        errors.push(`Profissional nao encontrado: ${email}`);

      const vendorId = vendorByName.get(normalizeName(vendorName));
      if (!vendorName) errors.push('Fabricante obrigatorio');
      else if (!vendorId) errors.push(`Fabricante nao encontrado: ${vendorName}`);

      let certificationId: string | undefined;
      if (!certName) errors.push('Certificacao obrigatoria');
      else if (vendorId) {
        certificationId = certByVendorAndName.get(
          `${vendorId}::${normalizeName(certName)}`,
        );
        if (!certificationId)
          errors.push(
            `Certificacao nao encontrada para ${vendorName}: ${certName}`,
          );
      }

      const obtainedAt = obtainedRaw ? parseDate(obtainedRaw) : null;
      if (obtainedRaw && !obtainedAt) errors.push(`Data de obtencao invalida: ${obtainedRaw}`);
      const expiresAt = expiresRaw ? parseDate(expiresRaw) : null;
      if (expiresRaw && !expiresAt) errors.push(`Data de expiracao invalida: ${expiresRaw}`);
      if (obtainedAt && expiresAt && expiresAt < obtainedAt) {
        errors.push('Expiracao anterior a obtencao');
      }

      if (professionalId && certificationId) {
        const key = `${professionalId}::${certificationId}`;
        if (openLinks.has(key)) errors.push('Certificacao ja em vigor');
        else if (seenLinks.has(key)) errors.push('Registro repetido no arquivo');
        else seenLinks.add(key);
      }

      return {
        line,
        status: errors.length === 0 ? 'valid' : 'invalid',
        errors,
        data: {
          professional_email: email,
          vendor: vendorName,
          certification: certName,
          obtained_at: obtainedAt ? this.iso(obtainedAt) : '',
          expires_at: expiresAt ? this.iso(expiresAt) : '',
          certificate_number: certificateNumber,
        },
      };
    });
  }

  private async importProfessionals(
    rows: ImportRowResult[],
    actor: AuthenticatedUser,
  ): Promise<ImportOutcome> {
    let imported = 0;
    const errors: { line: number; errors: string[] }[] = [];

    for (const row of rows) {
      try {
        // Gravacao + auditoria na mesma transacao: nunca fica registro sem log.
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.professional.create({
            data: {
              name: row.data.name,
              email: row.data.email.toLowerCase(),
              position: row.data.position || null,
              professionalType:
                (row.data.professional_type as ProfessionalType) || null,
              seniority: (row.data.seniority as Seniority) || null,
              role: Role.CONSULTANT,
              active: true,
            },
            select: { id: true, name: true, email: true },
          });

          await this.audit.record(
            {
              actorId: actor.id,
              entity: 'professionals',
              entityId: created.id,
              action: 'CREATE',
              after: { ...created, origin: 'import' },
            },
            tx,
          );
        });
        imported += 1;
      } catch (error) {
        errors.push({ line: row.line, errors: [this.importErrorMessage(error)] });
      }
    }

    return { imported, errors };
  }

  private async importCertifications(
    rows: ImportRowResult[],
    actor: AuthenticatedUser,
  ): Promise<ImportOutcome> {
    const [professionals, vendors, certifications] = await Promise.all([
      this.prisma.professional.findMany({ select: { id: true, email: true } }),
      this.prisma.vendor.findMany({ select: { id: true, name: true } }),
      this.prisma.certification.findMany({
        select: { id: true, name: true, vendorId: true },
      }),
    ]);

    const professionalByEmail = new Map(
      professionals.map((item) => [item.email.toLowerCase(), item.id]),
    );
    const vendorByName = new Map(
      vendors.map((item) => [normalizeName(item.name), item.id]),
    );
    const certByVendorAndName = new Map(
      certifications.map((item) => [
        `${item.vendorId}::${normalizeName(item.name)}`,
        item.id,
      ]),
    );

    let imported = 0;
    const errors: { line: number; errors: string[] }[] = [];

    for (const row of rows) {
      const professionalId = professionalByEmail.get(
        row.data.professional_email.toLowerCase(),
      );
      const vendorId = vendorByName.get(normalizeName(row.data.vendor));
      const certificationId = vendorId
        ? certByVendorAndName.get(`${vendorId}::${normalizeName(row.data.certification)}`)
        : undefined;

      // Revalidacao: as referencias precisam existir no momento da gravacao.
      const missing: string[] = [];
      if (!professionalId) {
        missing.push(
          `Profissional nao encontrado: ${row.data.professional_email}`,
        );
      }
      if (!certificationId) {
        missing.push(
          `Certificacao nao encontrada para ${row.data.vendor}: ${row.data.certification}`,
        );
      }
      if (missing.length > 0) {
        errors.push({ line: row.line, errors: missing });
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.professionalCertification.create({
            data: {
              professionalId: professionalId as string,
              certificationId: certificationId as string,
              obtainedAt: row.data.obtained_at
                ? parseDate(row.data.obtained_at)
                : null,
              expiresAt: row.data.expires_at
                ? parseDate(row.data.expires_at)
                : null,
              certificateNumber: row.data.certificate_number || null,
            },
            select: { id: true },
          });

          await this.audit.record(
            {
              actorId: actor.id,
              entity: 'professional_certifications',
              entityId: created.id,
              action: 'CREATE',
              after: { professionalId, certificationId, origin: 'import' },
            },
            tx,
          );
        });
        imported += 1;
      } catch (error) {
        errors.push({ line: row.line, errors: [this.importErrorMessage(error)] });
      }
    }

    return { imported, errors };
  }

  /** Mensagem amigavel para falhas de gravacao durante a importacao. */
  private importErrorMessage(error: unknown): string {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return 'Registro duplicado: o valor ja existe';
    }
    return 'Nao foi possivel gravar este registro';
  }

  private enumMap<T extends string>(values: T[]): Record<string, T> {
    return Object.fromEntries(values.map((value) => [normalizeName(value), value]));
  }

  private iso(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
