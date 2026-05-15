import type { DbClient } from './client';
import { auditLogs, type NewAuditLog } from './schema';

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>;

export function createAuditLogRepository(db: DbClient) {
  return {
    async write(
      input: Pick<NewAuditLog, 'actorId' | 'action' | 'entityType' | 'entityId' | 'metadata'>
    ) {
      const [auditLog] = await db
        .insert(auditLogs)
        .values({
          actorId: input.actorId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: input.metadata,
        })
        .returning();

      return auditLog;
    },
  };
}
