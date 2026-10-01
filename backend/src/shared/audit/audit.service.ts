import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  entity: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}

/**
 * Cliente minimo necessario para gravar auditoria. Aceita tanto o
 * PrismaService quanto um cliente de transacao, permitindo que a auditoria
 * seja gravada na MESMA transacao da alteracao (evita log orfao/ausente).
 */
export interface AuditClient {
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
}

/**
 * Auditoria de alteracoes criticas. Falhas de auditoria nao devem derrubar
 * a operacao principal: sao registradas em log e ignoradas.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, client: AuditClient = this.prisma): Promise<void> {
    try {
      await client.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar auditoria de ${entry.entity}#${entry.entityId}: ${String(error)}`,
      );
    }
  }
}
