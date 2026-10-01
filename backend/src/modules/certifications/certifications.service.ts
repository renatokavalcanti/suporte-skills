import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { buildOrderBy } from '../../shared/common/sorting';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { QueryCertificationsDto } from './dto/query-certifications.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

const CERTIFICATION_SELECT = {
  id: true,
  vendorId: true,
  technologyId: true,
  name: true,
  code: true,
  level: true,
  officialUrl: true,
  validityMonths: true,
  catalogStatus: true,
  description: true,
  notes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, name: true } },
  technology: { select: { id: true, name: true } },
  _count: { select: { professionalCertifications: true } },
} satisfies Prisma.CertificationSelect;

type CertificationRow = Prisma.CertificationGetPayload<{
  select: typeof CERTIFICATION_SELECT;
}>;

const SORTABLE = [
  'name',
  'code',
  'level',
  'catalogStatus',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class CertificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: QueryCertificationsDto,
  ): Promise<Paginated<CertificationRow>> {
    const where: Prisma.CertificationWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.technologyId) where.technologyId = query.technologyId;
    if (query.level) where.level = query.level;
    if (query.catalogStatus) where.catalogStatus = query.catalogStatus;
    if (typeof query.active === 'boolean') where.active = query.active;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'name',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.certification.count({ where }),
      this.prisma.certification.findMany({
        where,
        orderBy,
        skip,
        take,
        select: CERTIFICATION_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<CertificationRow> {
    const row = await this.prisma.certification.findUnique({
      where: { id },
      select: CERTIFICATION_SELECT,
    });
    if (!row) throw new NotFoundException('Certificacao nao encontrada');
    return row;
  }

  async create(
    dto: CreateCertificationDto,
    actor: AuthenticatedUser,
  ): Promise<CertificationRow> {
    await this.assertVendorExists(dto.vendorId);
    if (dto.technologyId) {
      await this.assertTechnologyBelongsToVendor(
        dto.technologyId,
        dto.vendorId,
      );
    }

    const created = await this.prisma.certification.create({
      data: {
        vendorId: dto.vendorId,
        technologyId: dto.technologyId ?? null,
        name: dto.name.trim(),
        code: dto.code?.trim() ?? null,
        level: dto.level ?? null,
        officialUrl: dto.officialUrl?.trim() ?? null,
        validityMonths: dto.validityMonths ?? null,
        catalogStatus: dto.catalogStatus ?? 'ACTIVE',
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      },
      select: CERTIFICATION_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'certifications',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateCertificationDto,
    actor: AuthenticatedUser,
  ): Promise<CertificationRow> {
    const existing = await this.prisma.certification.findUnique({
      where: { id },
      select: CERTIFICATION_SELECT,
    });
    if (!existing) throw new NotFoundException('Certificacao nao encontrada');

    const vendorId = dto.vendorId ?? existing.vendorId;
    if (dto.vendorId !== undefined) await this.assertVendorExists(dto.vendorId);
    if (dto.technologyId) {
      await this.assertTechnologyBelongsToVendor(dto.technologyId, vendorId);
    }

    const data: Prisma.CertificationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code?.trim() ?? null;
    if (dto.level !== undefined) data.level = dto.level ?? null;
    if (dto.officialUrl !== undefined)
      data.officialUrl = dto.officialUrl?.trim() ?? null;
    if (dto.validityMonths !== undefined)
      data.validityMonths = dto.validityMonths ?? null;
    if (dto.catalogStatus !== undefined)
      data.catalogStatus = dto.catalogStatus;
    if (dto.description !== undefined)
      data.description = dto.description ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.vendorId !== undefined)
      data.vendor = { connect: { id: dto.vendorId } };
    if (dto.technologyId !== undefined)
      data.technology = dto.technologyId
        ? { connect: { id: dto.technologyId } }
        : { disconnect: true };

    const updated = await this.prisma.certification.update({
      where: { id },
      data,
      select: CERTIFICATION_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'certifications',
      entityId: id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });

    return updated;
  }

  async setActive(
    id: string,
    active: boolean,
    actor: AuthenticatedUser,
  ): Promise<CertificationRow> {
    const existing = await this.prisma.certification.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Certificacao nao encontrada');

    const updated = await this.prisma.certification.update({
      where: { id },
      data: { active },
      select: CERTIFICATION_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'certifications',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.certification.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Certificacao nao encontrada');

    await this.prisma.certification.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'certifications',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }

  private async assertVendorExists(vendorId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) {
      throw new BadRequestException('Fabricante informado nao existe');
    }
  }

  private async assertTechnologyBelongsToVendor(
    technologyId: string,
    vendorId: string,
  ): Promise<void> {
    const technology = await this.prisma.technology.findUnique({
      where: { id: technologyId },
      select: { id: true, vendorId: true },
    });
    if (!technology) {
      throw new BadRequestException('Tecnologia informada nao existe');
    }
    if (technology.vendorId !== vendorId) {
      throw new BadRequestException(
        'A tecnologia selecionada nao pertence ao fabricante informado',
      );
    }
  }
}
