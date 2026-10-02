import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Prisma, Role, RoadmapStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import {
  AuthenticatedUser,
} from '../../shared/common/authenticated-user.interface';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { buildOrderBy } from '../../shared/common/sorting';
import {
  CertificationStatus,
  CertificationStatusService,
} from '../../shared/domain/certification-status.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { QueryProfessionalsDto } from './dto/query-professionals.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

const PROFESSIONAL_SELECT = {
  id: true,
  name: true,
  email: true,
  position: true,
  role: true,
  professionalType: true,
  seniority: true,
  active: true,
  mustChangePassword: true,
  hireDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProfessionalSelect;

type ProfessionalRow = Prisma.ProfessionalGetPayload<{
  select: typeof PROFESSIONAL_SELECT;
}>;

export interface ProfessionalWithStats extends ProfessionalRow {
  stats: {
    certifications: number;
    expiring: number;
    expired: number;
    openRoadmap: number;
  };
}

const SORTABLE = [
  'name',
  'email',
  'position',
  'role',
  'seniority',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class ProfessionalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusService: CertificationStatusService,
  ) {}

  async list(
    query: QueryProfessionalsDto,
    _actor: AuthenticatedUser,
  ): Promise<Paginated<ProfessionalWithStats>> {
    const where: Prisma.ProfessionalWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { position: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.active === 'boolean') where.active = query.active;
    if (query.role) where.role = query.role;
    if (query.professionalType) where.professionalType = query.professionalType;
    if (query.seniority) where.seniority = query.seniority;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'name',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.professional.count({ where }),
      this.prisma.professional.findMany({
        where,
        orderBy,
        skip,
        take,
        select: PROFESSIONAL_SELECT,
      }),
    ]);

    return { data: await this.withStats(rows), meta: buildMeta(total, query) };
  }

  async getById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalWithStats> {
    if (actor.role === Role.CONSULTANT && actor.id !== id) {
      throw new ForbiddenException(
        'Voce so pode visualizar o seu proprio perfil',
      );
    }

    const row = await this.prisma.professional.findUnique({
      where: { id },
      select: PROFESSIONAL_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Profissional nao encontrado');
    }
    const [withStats] = await this.withStats([row]);
    return withStats;
  }

  async create(
    dto: CreateProfessionalDto,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalWithStats> {
    this.assertCredentialsAllowed(dto.role, dto.password, dto.mustChangePassword, actor);

    const created = await this.prisma.professional.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        position: dto.position?.trim() ?? null,
        professionalType: dto.professionalType ?? null,
        seniority: dto.seniority ?? null,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        notes: dto.notes ?? null,
        role: dto.role ?? Role.CONSULTANT,
        passwordHash: dto.password ? await hash(dto.password) : null,
        mustChangePassword: dto.password
          ? dto.mustChangePassword ?? true
          : false,
        active: dto.active ?? true,
      },
      select: PROFESSIONAL_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'professionals',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    const [withStats] = await this.withStats([created]);
    return withStats;
  }

  async update(
    id: string,
    dto: UpdateProfessionalDto,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalWithStats> {
    this.assertCredentialsAllowed(dto.role, dto.password, dto.mustChangePassword, actor);

    const existing = await this.prisma.professional.findUnique({
      where: { id },
      select: PROFESSIONAL_SELECT,
    });
    if (!existing) {
      throw new NotFoundException('Profissional nao encontrado');
    }

    const data: Prisma.ProfessionalUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.position !== undefined) data.position = dto.position?.trim() ?? null;
    if (dto.professionalType !== undefined)
      data.professionalType = dto.professionalType ?? null;
    if (dto.seniority !== undefined) data.seniority = dto.seniority ?? null;
    if (dto.hireDate !== undefined)
      data.hireDate = dto.hireDate ? new Date(dto.hireDate) : null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password !== undefined) {
      data.passwordHash = dto.password ? await hash(dto.password) : null;
      // Nova senha definida pelo ADMIN: provisoria por padrao (D-024).
      if (dto.password) {
        data.mustChangePassword = dto.mustChangePassword ?? true;
      } else if (dto.mustChangePassword !== undefined) {
        data.mustChangePassword = dto.mustChangePassword;
      }
    } else if (dto.mustChangePassword !== undefined) {
      data.mustChangePassword = dto.mustChangePassword;
    }

    const updated = await this.prisma.professional.update({
      where: { id },
      data,
      select: PROFESSIONAL_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'professionals',
      entityId: id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });

    const [withStats] = await this.withStats([updated]);
    return withStats;
  }

  async setActive(
    id: string,
    active: boolean,
    actor: AuthenticatedUser,
  ): Promise<ProfessionalWithStats> {
    const existing = await this.prisma.professional.findUnique({
      where: { id },
      select: PROFESSIONAL_SELECT,
    });
    if (!existing) {
      throw new NotFoundException('Profissional nao encontrado');
    }

    const updated = await this.prisma.professional.update({
      where: { id },
      data: { active },
      select: PROFESSIONAL_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'professionals',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    const [withStats] = await this.withStats([updated]);
    return withStats;
  }

  /**
   * Desativacao (soft delete). Preserva historico de certificacoes e roadmap.
   */
  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.professional.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) {
      throw new NotFoundException('Profissional nao encontrado');
    }

    await this.prisma.professional.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'professionals',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }

  private assertCredentialsAllowed(
    role: Role | undefined,
    password: string | undefined,
    mustChangePassword: boolean | undefined,
    actor: AuthenticatedUser,
  ): void {
    const touchesCredentials =
      role !== undefined ||
      password !== undefined ||
      mustChangePassword !== undefined;
    if (touchesCredentials && actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores podem definir papel de acesso ou senha',
      );
    }
  }

  private async withStats(
    rows: ProfessionalRow[],
  ): Promise<ProfessionalWithStats[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);

    const [certs, roadmapCounts] = await Promise.all([
      this.prisma.professionalCertification.findMany({
        where: { professionalId: { in: ids } },
        select: { professionalId: true, expiresAt: true },
      }),
      this.prisma.roadmapItem.groupBy({
        by: ['professionalId'],
        where: {
          professionalId: { in: ids },
          status: { notIn: [RoadmapStatus.COMPLETED, RoadmapStatus.CANCELLED] },
        },
        _count: { _all: true },
      }),
    ]);

    const counters = new Map<
      string,
      { certifications: number; expiring: number; expired: number }
    >();
    for (const cert of certs) {
      const current = counters.get(cert.professionalId) ?? {
        certifications: 0,
        expiring: 0,
        expired: 0,
      };
      current.certifications += 1;
      const status = this.statusService.resolve(cert.expiresAt);
      if (status === CertificationStatus.EXPIRING) current.expiring += 1;
      if (status === CertificationStatus.EXPIRED) current.expired += 1;
      counters.set(cert.professionalId, current);
    }

    const roadmapMap = new Map(
      roadmapCounts.map((item) => [item.professionalId, item._count._all]),
    );

    return rows.map((row) => {
      const counter = counters.get(row.id);
      return {
        ...row,
        stats: {
          certifications: counter?.certifications ?? 0,
          expiring: counter?.expiring ?? 0,
          expired: counter?.expired ?? 0,
          openRoadmap: roadmapMap.get(row.id) ?? 0,
        },
      };
    });
  }
}
