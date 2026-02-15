import { eq, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects, apiKeyProjects } from '../db/schema/index.js';
import type { Project } from '../types.js';

export async function createProject(slug: string, label: string, nodionApiKey: string): Promise<void> {
  await db.insert(projects).values({
    slug,
    label,
    nodionApiKeyEncrypted: nodionApiKey,
    createdAt: new Date().toISOString(),
  });
}

export async function getProject(slug: string): Promise<Project | null> {
  const rows = await db.select().from(projects).where(eq(projects.slug, slug));
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    slug: row.slug,
    label: row.label,
    nodionApiKeyEncrypted: row.nodionApiKeyEncrypted,
    createdAt: row.createdAt,
  };
}

export async function listProjects(): Promise<Omit<Project, 'nodionApiKeyEncrypted'>[]> {
  const rows = await db.select({
    slug: projects.slug,
    label: projects.label,
    createdAt: projects.createdAt,
  }).from(projects).orderBy(projects.createdAt);
  return rows;
}

export async function updateProject(slug: string, updates: { label?: string; nodionApiKey?: string }): Promise<boolean> {
  const set: Record<string, string> = {};
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.nodionApiKey !== undefined) set.nodionApiKeyEncrypted = updates.nodionApiKey;
  if (Object.keys(set).length === 0) return false;

  const result = await db.update(projects).set(set).where(eq(projects.slug, slug));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function deleteProject(slug: string): Promise<boolean> {
  const result = await db.delete(projects).where(eq(projects.slug, slug));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function getProjectsForKey(keyId: string): Promise<{ slug: string; label: string }[]> {
  const rows = await db
    .select({ slug: projects.slug, label: projects.label })
    .from(projects)
    .innerJoin(apiKeyProjects, eq(projects.slug, apiKeyProjects.projectSlug))
    .where(eq(apiKeyProjects.keyId, keyId))
    .orderBy(projects.slug);
  return rows;
}

export async function getAccessibleProjects(keyId: string, role: string): Promise<{ slug: string; label: string }[]> {
  const restrictions = await db
    .select({ value: count() })
    .from(apiKeyProjects)
    .where(eq(apiKeyProjects.keyId, keyId));

  if (role === 'admin' && restrictions[0].value === 0) {
    return db.select({ slug: projects.slug, label: projects.label }).from(projects).orderBy(projects.slug);
  }

  return getProjectsForKey(keyId);
}
