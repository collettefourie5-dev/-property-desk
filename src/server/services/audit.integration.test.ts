import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent, AuditAction } from '@/server/services/audit';

describe('recordAuditEvent (integration)', () => {
  const targetId = `test-target-${Date.now()}`;

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetId } });
    await prisma.$disconnect();
  });

  it('writes a row with the given action, target, and metadata', async () => {
    await recordAuditEvent({
      action: AuditAction.ADMIN_ACTION,
      targetType: 'Test',
      targetId,
      metadata: { reason: 'vitest integration test' },
    });

    const rows = await prisma.auditLog.findMany({ where: { targetId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: AuditAction.ADMIN_ACTION,
      targetType: 'Test',
      targetId,
    });
  });
});
