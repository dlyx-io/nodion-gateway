import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { blocklist } from '../db/schema/index.js';
import type { BlocklistEntry } from '../types.js';

export async function addToBlocklist(appId: string, projectSlug: string, reason: string): Promise<void> {
  await db.insert(blocklist).values({
    appId,
    projectSlug,
    reason,
    createdAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [blocklist.appId, blocklist.projectSlug],
    set: { reason },
  });
}

export async function removeFromBlocklist(appId: string, projectSlug: string): Promise<boolean> {
  const result = await db.delete(blocklist).where(
    and(eq(blocklist.appId, appId), eq(blocklist.projectSlug, projectSlug))
  );
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function isBlocked(appId: string, projectSlug: string): Promise<boolean> {
  const rows = await db
    .select({ appId: blocklist.appId })
    .from(blocklist)
    .where(and(eq(blocklist.appId, appId), eq(blocklist.projectSlug, projectSlug)));
  return rows.length > 0;
}

export async function listBlocked(projectSlug?: string): Promise<BlocklistEntry[]> {
  const conditions = projectSlug ? [eq(blocklist.projectSlug, projectSlug)] : [];

  const rows = await db
    .select()
    .from(blocklist)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(blocklist.createdAt));

  return rows.map((row) => ({
    appId: row.appId,
    projectSlug: row.projectSlug,
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}
