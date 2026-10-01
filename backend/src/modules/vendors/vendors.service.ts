import { Injectable, NotFoundException } from '@nestjs/common';
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
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

const VENDOR_SELECT = {
  id: true,
  name: true,
  website: true,
  logoUrl: true,
  partnershipStatus: true,
  partnershipLevel: true,
  partnershipStartDate: true,
  partnershipRenewalDate: true,
  notes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { technologies: true, certifications: true } },
} satisfies Prisma.VendorSelect;

type VendorRow = Prisma.VendorGetPayload<{ select: typeof VENDOR_SELECT }>;

const SORTABLE = [
  'name',
  'partnershipStatus',
  'partnershipRenewalDate',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryVendorsDto): Promise<Paginated<VendorRow>> {
    const where: Prisma.VendorWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { partnershipLevel: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.active === 'boolean') where.active = query.active;
    if (query.partnershipStatus)
      where.partnershipStatus = query.partnershipStatus;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'name',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({
        where,
        orderBy,
        skip,
        take,
        select: VENDOR_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<VendorRow> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      select: VENDOR_SELECT,
    });
    if (!vendor) throw new NotFoundException('Fabricante nao encontrado');
    return vendor;
  }

  async create(
    dto: CreateVendorDto,
    actor: AuthenticatedUser,
  ): Promise<VendorRow> {
    const created = await this.prisma.vendor.create({
      data: {
        name: dto.name.trim(),
        website: dto.website?.trim() ?? null,
        logoUrl: dto.logoUrl?.trim() ?? null,
        partnershipStatus: dto.partnershipStatus ?? 'NONE',
        partnershipLevel: dto.partnershipLevel?.trim() ?? null,
        partnershipStartDate: dto.partnershipStartDate
          ? new Date(dto.partnershipStartDate)
          : null,
        partnershipRenewalDate: dto.partnershipRenewalDate
          ? new Date(dto.partnershipRenewalDate)
          : null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      },
      select: VENDOR_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'vendors',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    actor: AuthenticatedUser,
  ): Promise<VendorRow> {
    const existing = await this.prisma.vendor.findUnique({
      where: { id },
      select: VENDOR_SELECT,
    });
    if (!existing) throw new NotFoundException('Fabricante nao encontrado');

    const data: Prisma.VendorUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.website !== undefined) data.website = dto.website?.trim() ?? null;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl?.trim() ?? null;
    if (dto.partnershipStatus !== undefined)
      data.partnershipStatus = dto.partnershipStatus;
    if (dto.partnershipLevel !== undefined)
      data.partnershipLevel = dto.partnershipLevel?.trim() ?? null;
    if (dto.partnershipStartDate !== undefined)
      data.partnershipStartDate = dto.partnershipStartDate
        ? new Date(dto.partnershipStartDate)
        : null;
    if (dto.partnershipRenewalDate !== undefined)
      data.partnershipRenewalDate = dto.partnershipRenewalDate
        ? new Date(dto.partnershipRenewalDate)
        : null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.vendor.update({
      where: { id },
      data,
      select: VENDOR_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'vendors',
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
  ): Promise<VendorRow> {
    const existing = await this.prisma.vendor.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Fabricante nao encontrado');

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { active },
      select: VENDOR_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'vendors',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.vendor.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Fabricante nao encontrado');

    await this.prisma.vendor.update({ where: { id }, data: { active: false } });

    await this.audit.record({
      actorId: actor.id,
      entity: 'vendors',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }
}
