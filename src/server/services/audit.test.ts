import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: { auditLog: { create: vi.fn().mockRejectedValue(new Error('connection refused')) } },
}));

import { recordAuditEvent, AuditAction } from '@/server/services/audit';

describe('recordAuditEvent', () => {
  it('never throws, even when the database write fails', async () => {
    await expect(
      recordAuditEvent({ action: AuditAction.LOGIN, actorId: 'user_1' }),
    ).resolves.toBeUndefined();
  });
});
