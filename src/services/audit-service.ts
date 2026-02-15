import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { auditLog } from '../db/schema/index.js';
import type { AuditEntry } from '../types.js';

export async function log(entry: {
  keyId: string | null;
  projectSlug: string | null;
  method: string;
  endpoint: string;
  appId?: string | null;
  result: 'allowed' | 'blocked' | 'error';
  reason?: string | null;
  responseStatus?: number | null;
}): Promise<void> {
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    keyId: entry.keyId,
    projectSlug: entry.projectSlug,
    method: entry.method,
    endpoint: entry.endpoint,
    appId: entry.appId ?? null,
    result: entry.result,
    reason: entry.reason ?? null,
    responseStatus: entry.responseStatus ?? null,
  });
}

export interface AuditQueryParams {
  keyId?: string;
  project?: string;
  method?: string;
  result?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function query(params: AuditQueryParams): Promise<AuditEntry[]> {
  const conditions = [];

  if (params.keyId) conditions.push(eq(auditLog.keyId, params.keyId));
  if (params.project) conditions.push(eq(auditLog.projectSlug, params.project));
  if (params.method) conditions.push(eq(auditLog.method, params.method.toUpperCase()));
  if (params.result) conditions.push(eq(auditLog.result, params.result));
  if (params.from) conditions.push(gte(auditLog.timestamp, params.from));
  if (params.to) conditions.push(lte(auditLog.timestamp, params.to));

  const limit = params.limit ?? 100;

  const rows = await db
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    keyId: row.keyId,
    projectSlug: row.projectSlug,
    method: row.method,
    endpoint: row.endpoint,
    appId: row.appId,
    result: row.result as 'allowed' | 'blocked' | 'error',
    reason: row.reason,
    responseStatus: row.responseStatus,
  }));
}
