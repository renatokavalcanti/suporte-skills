import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  RoadmapPriority,
  RoadmapStatus,
  RoadmapType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { assertProfessionalAccess } from '../../shared/common/access';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import {
  ATTACHMENT_FOLDERS,
  AttachmentStorageService,
} from '../../shared/storage/attachment-storage.service';
import {
  assertPdfUpload,
  sanitizeAttachmentName,
} from '../../shared/storage/pdf-attachment';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { buildOrderBy } from '../../shared/common/sorting';
import { CreateRoadmapItemDto } from './dto/create-roadmap-item.dto';
import { QueryRoadmapDto } from './dto/query-roadmap.dto';
import { UpdateRoadmapItemDto } from './dto/update-roadmap-item.dto';
const ITEM_SELECT = {
  id: true,
  professionalId: true,
  technologyId: true,
  certificationId: true,
  title: true,
  objective: true,
  description: true,
  type: true,
  priority: true,
  status: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  ownerId: true,
  notes: true,
  attachmentFile: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  attachmentUploadedAt: true,
  createdAt: true,
  updatedAt: true,
  professional: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  technology: { select: { id: true, name: true, vendor: { select: { id: true, name: true } } } },
  certification: { select: { id: true, name: true, code: true, vendor: { select: { id: true, name: true } } } },
} satisfies Prisma.RoadmapItemSelect;

type ItemRow = Prisma.RoadmapItemGetPayload<{ select: typeof ITEM_SELECT }>;

export type RoadmapItemView = Omit<ItemRow, 'attachmentFile'> & {
  /** Indica se ha anexo sem expor o nome interno no disco (D-026). */
  hasAttachment: boolean;
  isOverdue: boolean;
  daysToDue: number | null;
};

export interface RoadmapAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
}

const ROADMAP_FOLDER = ATTACHMENT_FOLDERS.roadmap;

const KANBAN_ORDER: RoadmapStatus[] = [
  RoadmapStatus.BACKLOG,
  RoadmapStatus.PLANNED,
  RoadmapStatus.IN_PROGRESS,
  RoadmapStatus.COMPLETED,
  RoadmapStatus.CANCELLED,
];

const SORTABLE = [
  'title',
  'priority',
  'status',
  'type',
  'startDate',
  'dueDate',
  'createdAt',
  'updatedAt',
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class RoadmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly storage: AttachmentStorageService,
  ) {}

  async list(query: QueryRoadmapDto): Promise<Paginated<RoadmapItemView>> {
    const where = this.buildWhere(query);
    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'dueDate',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.roadmapItem.count({ where }),
      this.prisma.roadmapItem.findMany({
        where,
        orderBy,
        skip,
        take,
        select: ITEM_SELECT,
      }),
    ]);

    return { data: rows.map((row) => this.toView(row)), meta: buildMeta(total, query) };
  }

  async kanban(query: QueryRoadmapDto): Promise<Record<RoadmapStatus, RoadmapItemView[]>> {
    const where = this.buildWhere(query);
    const rows = await this.prisma.roadmapItem.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 500,
      select: ITEM_SELECT,
    });

    const grouped = Object.fromEntries(
      KANBAN_ORDER.map((status) => [status, [] as RoadmapItemView[]]),
    ) as Record<RoadmapStatus, RoadmapItemView[]>;

    for (const row of rows) {
      grouped[row.status].push(this.toView(row));
    }
    return grouped;
  }

  async timeline(query: QueryRoadmapDto): Promise<RoadmapItemView[]> {
    const where = this.buildWhere(query);
    const rows = await this.prisma.roadmapItem.findMany({
      where,
      orderBy: [{ startDate: { sort: 'asc', nulls: 'last' } }, { dueDate: 'asc' }],
      take: 300,
      select: ITEM_SELECT,
    });
    return rows.map((row) => this.toView(row));
  }

  /** Itens de um profissional (usado na aba de roadmap do perfil). */
  async listByProfessional(professionalId: string): Promise<RoadmapItemView[]> {
    const rows = await this.prisma.roadmapItem.findMany({
      where: { professionalId },
      orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      select: ITEM_SELECT,
    });
    return rows.map((row) => this.toView(row));
  }

  async getById(id: string): Promise<RoadmapItemView> {
    const row = await this.prisma.roadmapItem.findUnique({
      where: { id },
      select: ITEM_SELECT,
    });
    if (!row) throw new NotFoundException('Item de roadmap nao encontrado');
    return this.toView(row);
  }

  async create(
    dto: CreateRoadmapItemDto,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    await this.assertProfessionalExists(dto.professionalId);
    const technologyId = await this.resolveTechnology(
      dto.technologyId,
      dto.certificationId,
    );
    this.assertDates(dto.startDate, dto.dueDate);

    const created = await this.prisma.roadmapItem.create({
      data: {
        professionalId: dto.professionalId,
        technologyId,
        certificationId: dto.certificationId ?? null,
        title: dto.title.trim(),
        objective: dto.objective?.trim() || null,
        description: dto.description?.trim() || null,
        type: dto.type,
        priority: dto.priority ?? RoadmapPriority.MEDIUM,
        status: dto.status ?? RoadmapStatus.BACKLOG,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        ownerId: dto.ownerId ?? null,
        notes: dto.notes?.trim() || null,
        completedAt: dto.status === RoadmapStatus.COMPLETED ? new Date() : null,
      },
      select: ITEM_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: created.id,
      action: 'CREATE',
      after: this.payload(created),
    });

    return this.toView(created);
  }

  async update(
    id: string,
    dto: UpdateRoadmapItemDto,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    const existing = await this.findRow(id);

    if (dto.professionalId !== undefined)
      await this.assertProfessionalExists(dto.professionalId);
    this.assertDates(
      dto.startDate ?? this.toIso(existing.startDate),
      dto.dueDate ?? this.toIso(existing.dueDate),
    );

    const data: Prisma.RoadmapItemUpdateInput = {};
    if (dto.professionalId !== undefined)
      data.professional = { connect: { id: dto.professionalId } };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.objective !== undefined) data.objective = dto.objective?.trim() || null;
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.startDate !== undefined)
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.ownerId !== undefined)
      data.owner = dto.ownerId
        ? { connect: { id: dto.ownerId } }
        : { disconnect: true };
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (dto.technologyId !== undefined || dto.certificationId !== undefined) {
      // So mexe no vinculo de certificacao quando ele foi enviado
      // explicitamente; caso contrario o vinculo atual seria apagado.
      if (dto.certificationId !== undefined) {
        data.certification = dto.certificationId
          ? { connect: { id: dto.certificationId } }
          : { disconnect: true };
      }

      const technologyId = await this.resolveTechnology(
        dto.technologyId ?? existing.technologyId ?? undefined,
        dto.certificationId ?? existing.certificationId ?? undefined,
      );
      data.technology = technologyId
        ? { connect: { id: technologyId } }
        : { disconnect: true };
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
      data.completedAt =
        dto.status === RoadmapStatus.COMPLETED
          ? (existing.completedAt ?? new Date())
          : null;
    }

    const updated = await this.prisma.roadmapItem.update({
      where: { id },
      data,
      select: ITEM_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: id,
      action: 'UPDATE',
      before: this.payload(existing),
      after: this.payload(updated),
    });

    return this.toView(updated);
  }

  /** Usado pelo drag-and-drop do Kanban. */
  async setStatus(
    id: string,
    status: RoadmapStatus,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    const existing = await this.findRow(id);

    const updated = await this.prisma.roadmapItem.update({
      where: { id },
      data: {
        status,
        completedAt:
          status === RoadmapStatus.COMPLETED
            ? (existing.completedAt ?? new Date())
            : null,
      },
      select: ITEM_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: id,
      action: 'UPDATE',
      before: { status: existing.status },
      after: { status: updated.status },
    });

    return this.toView(updated);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.findRow(id);
    await this.prisma.roadmapItem.delete({ where: { id } });
    // O anexo do item nao sobrevive a remocao (D-026).
    if (existing.attachmentFile) {
      await this.storage.remove(existing.attachmentFile, ROADMAP_FOLDER);
    }
    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: id,
      action: 'DELETE',
      before: this.payload(existing),
    });
  }

  // --- Autoatendimento do CONSULTANT (D-026) ------------------------------
  // Mesmo padrao da D-019: o CONSULTANT mantem os PROPRIOS itens pela aba do
  // perfil. O escopo e' validado aqui e a rota aninhada fixa o profissional.

  async createForProfessional(
    professionalId: string,
    dto: Omit<CreateRoadmapItemDto, 'professionalId'>,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    assertProfessionalAccess(professionalId, actor);
    return this.create({ ...dto, professionalId, ownerId: undefined }, actor);
  }

  async updateForProfessional(
    professionalId: string,
    itemId: string,
    dto: UpdateRoadmapItemDto,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertItemBelongsTo(professionalId, itemId);
    // Nao permite mover o item para outro profissional nem reatribuir o dono.
    return this.update(
      itemId,
      { ...dto, professionalId: undefined, ownerId: undefined },
      actor,
    );
  }

  async setStatusForProfessional(
    professionalId: string,
    itemId: string,
    status: RoadmapStatus,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertItemBelongsTo(professionalId, itemId);
    return this.setStatus(itemId, status, actor);
  }

  async removeForProfessional(
    professionalId: string,
    itemId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertProfessionalAccess(professionalId, actor);
    await this.assertItemBelongsTo(professionalId, itemId);
    return this.remove(itemId, actor);
  }

  // --- Anexo do item de roadmap (D-026) -----------------------------------

  async uploadAttachment(
    professionalId: string,
    itemId: string,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<RoadmapItemView> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRow(itemId);
    if (existing.professionalId !== professionalId) {
      throw new NotFoundException('Item de roadmap nao encontrado');
    }
    assertPdfUpload(file, this.storage.maxFileBytes);

    const storedName = await this.storage.save(file!.buffer, '.pdf', ROADMAP_FOLDER);
    let updated: ItemRow;
    try {
      updated = await this.prisma.roadmapItem.update({
        where: { id: itemId },
        data: {
          attachmentFile: storedName,
          attachmentName: sanitizeAttachmentName(file!.originalname),
          attachmentMime: 'application/pdf',
          attachmentSize: file!.size,
          attachmentUploadedAt: new Date(),
        },
        select: ITEM_SELECT,
      });
    } catch (error) {
      await this.storage.remove(storedName, ROADMAP_FOLDER);
      throw error;
    }

    // Substituicao: o arquivo anterior deixa de existir.
    if (existing.attachmentFile && existing.attachmentFile !== storedName) {
      await this.storage.remove(existing.attachmentFile, ROADMAP_FOLDER);
    }

    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: itemId,
      action: 'UPDATE',
      before: { attachmentName: existing.attachmentName },
      after: {
        attachmentName: updated.attachmentName,
        replaced: Boolean(existing.attachmentFile),
      },
    });

    return this.toView(updated);
  }

  async getAttachment(
    professionalId: string,
    itemId: string,
    actor: AuthenticatedUser,
  ): Promise<RoadmapAttachment> {
    assertProfessionalAccess(professionalId, actor);
    const row = await this.findRow(itemId);

    if (row.professionalId !== professionalId || !row.attachmentFile) {
      throw new NotFoundException('Este item de roadmap nao possui anexo');
    }
    if (!(await this.storage.exists(row.attachmentFile, ROADMAP_FOLDER))) {
      throw new NotFoundException('Anexo nao encontrado no servidor');
    }

    return {
      path: this.storage.pathOf(row.attachmentFile, ROADMAP_FOLDER),
      name: row.attachmentName ?? 'comprovante.pdf',
      mime: row.attachmentMime ?? 'application/pdf',
      size: row.attachmentSize ?? 0,
    };
  }

  async removeAttachment(
    professionalId: string,
    itemId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertProfessionalAccess(professionalId, actor);
    const existing = await this.findRow(itemId);

    if (existing.professionalId !== professionalId || !existing.attachmentFile) {
      throw new NotFoundException('Este item de roadmap nao possui anexo');
    }

    await this.prisma.roadmapItem.update({
      where: { id: itemId },
      data: {
        attachmentFile: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        attachmentUploadedAt: null,
      },
    });
    await this.storage.remove(existing.attachmentFile, ROADMAP_FOLDER);

    await this.audit.record({
      actorId: actor.id,
      entity: 'roadmap_items',
      entityId: itemId,
      action: 'UPDATE',
      before: { attachmentName: existing.attachmentName },
      after: { attachmentName: null },
    });
  }

  // -------------------------------------------------------------------------

  private buildWhere(query: QueryRoadmapDto): Prisma.RoadmapItemWhereInput {
    const where: Prisma.RoadmapItemWhereInput = {};
    const and: Prisma.RoadmapItemWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { objective: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.professionalId) where.professionalId = query.professionalId;
    if (query.technologyId) where.technologyId = query.technologyId;
    if (query.certificationId) where.certificationId = query.certificationId;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;

    if (query.vendorId) {
      and.push({
        OR: [
          { technology: { vendorId: query.vendorId } },
          { certification: { vendorId: query.vendorId } },
        ],
      });
    }

    if (query.from || query.to) {
      const range: Prisma.DateTimeNullableFilter = {};
      if (query.from) range.gte = new Date(query.from);
      if (query.to) range.lte = new Date(query.to);
      where.dueDate = range;
    }

    if (query.overdue) {
      // Combina com o intervalo de datas em vez de sobrescreve-lo.
      and.push({ dueDate: { lt: this.today() } });
      and.push({
        status: { notIn: [RoadmapStatus.COMPLETED, RoadmapStatus.CANCELLED] },
      });
    }

    if (and.length > 0) where.AND = and;
    return where;
  }

  private toView(row: ItemRow): RoadmapItemView {
    const { attachmentFile, ...rest } = row;
    const overdue =
      row.dueDate !== null &&
      row.dueDate.getTime() < this.today().getTime() &&
      row.status !== RoadmapStatus.COMPLETED &&
      row.status !== RoadmapStatus.CANCELLED;

    const daysToDue = row.dueDate
      ? Math.round(
          (this.dateOnlyUtc(row.dueDate).getTime() - this.today().getTime()) /
            MS_PER_DAY,
        )
      : null;

    return {
      ...rest,
      hasAttachment: attachmentFile !== null,
      isOverdue: overdue,
      daysToDue,
    };
  }

  private payload(row: ItemRow) {
    return {
      professionalId: row.professionalId,
      title: row.title,
      status: row.status,
      priority: row.priority,
      dueDate: this.toIso(row.dueDate),
    } satisfies Prisma.InputJsonValue;
  }

  private async assertItemBelongsTo(
    professionalId: string,
    itemId: string,
  ): Promise<void> {
    const found = await this.prisma.roadmapItem.findFirst({
      where: { id: itemId, professionalId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Item de roadmap nao encontrado');
  }

  private async findRow(id: string): Promise<ItemRow> {
    const row = await this.prisma.roadmapItem.findUnique({
      where: { id },
      select: ITEM_SELECT,
    });
    if (!row) throw new NotFoundException('Item de roadmap nao encontrado');
    return row;
  }

  private async assertProfessionalExists(professionalId: string): Promise<void> {
    const found = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('Profissional informado nao existe');
  }

  /** Se vier certificacao sem tecnologia, usa a tecnologia da certificacao. */
  private async resolveTechnology(
    technologyId?: string,
    certificationId?: string,
  ): Promise<string | null> {
    if (technologyId) {
      const found = await this.prisma.technology.findUnique({
        where: { id: technologyId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException('Tecnologia informada nao existe');
      return technologyId;
    }
    if (certificationId) {
      const cert = await this.prisma.certification.findUnique({
        where: { id: certificationId },
        select: { id: true, technologyId: true },
      });
      if (!cert) throw new BadRequestException('Certificacao informada nao existe');
      return cert.technologyId;
    }
    return null;
  }

  private assertDates(
    startDate?: string | null,
    dueDate?: string | null,
  ): void {
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      throw new BadRequestException(
        'O prazo nao pode ser anterior a data de inicio',
      );
    }
  }

  private toIso(date: Date | null): string | null {
    return date ? new Date(date).toISOString().slice(0, 10) : null;
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

  private dateOnlyUtc(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
}

export const ROADMAP_TYPES = Object.values(RoadmapType);
