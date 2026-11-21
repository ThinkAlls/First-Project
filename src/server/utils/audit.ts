import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';

export interface AuditInput {
  userId?: number | null;
  userName: string;
  userRole: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'VERIFY' | 'DELETE' | 'LOGIN' | 'BOOTSTRAP';
  module: string;
  entityType: string;
  entityId?: number | null;
  transactionNumber?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

export async function logAudit(input: AuditInput, executor: typeof db | any = db): Promise<void> {
  try {
    await executor.insert(auditLogs).values({
      userId: input.userId ?? null,
      userName: input.userName,
      userRole: input.userRole,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      transactionNumber: input.transactionNumber ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}
