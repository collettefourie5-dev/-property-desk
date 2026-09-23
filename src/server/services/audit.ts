import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';

export const AuditAction = {
  USER_CREATED: 'USER_CREATED',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ADMIN_ACTION: 'ADMIN_ACTION',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export interface RecordAuditEventInput {
  actorId?: string | null;
  action: AuditActionType;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/** Never throws — an audit-log write failure must not break the operation it's recording. */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ipAddress: input.ipAddress ?? null,
        metadata: input.metadata as never,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log entry', {
      action: input.action,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
