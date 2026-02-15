import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { resources } from '../db/schema/index.js';
import type { Resource } from '../types.js';

export async function trackResource(appId: string, projectSlug: string, createdByKey: string, label?: string): Promise<void> {
  await db.insert(resources).values({
    appId,
    projectSlug,
    createdByKey,
    createdAt: new Date().toISOString(),
    label: label ?? null,
  }).onConflictDoUpdate({
    target: [resources.appId, resources.projectSlug],
    set: { createdByKey, label: label ?? null },
  });
}

export async function isOwner(appId: string, projectSlug: string, keyId: string): Promise<boolean> {
  const rows = await db
    .select({ appId: resources.appId })
    .from(resources)
    .where(and(
      eq(resources.appId, appId),
      eq(resources.projectSlug, projectSlug),
      eq(resources.createdByKey, keyId),
    ));
  return rows.length > 0;
}

export async function isTracked(appId: string, projectSlug: string): Promise<boolean> {
  const rows = await db
    .select({ appId: resources.appId })
    .from(resources)
    .where(and(eq(resources.appId, appId), eq(resources.projectSlug, projectSlug)));
  return rows.length > 0;
}

export async function removeResource(appId: string, projectSlug: string): Promise<void> {
  await db.delete(resources).where(
    and(eq(resources.appId, appId), eq(resources.projectSlug, projectSlug))
  );
}

export async function getResources(projectSlug?: string): Promise<Resource[]> {
  const conditions = projectSlug ? [eq(resources.projectSlug, projectSlug)] : [];

  const rows = await db
    .select()
    .from(resources)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(resources.createdAt));

  return rows.map((row) => ({
    appId: row.appId,
    projectSlug: row.projectSlug,
    createdByKey: row.createdByKey,
    createdAt: row.createdAt,
    label: row.label,
    lastDeployedAt: row.lastDeployedAt,
  }));
}

export async function updateLastDeployed(appId: string, projectSlug: string): Promise<void> {
  await db.update(resources)
    .set({ lastDeployedAt: new Date().toISOString() })
    .where(and(eq(resources.appId, appId), eq(resources.projectSlug, projectSlug)));
}
