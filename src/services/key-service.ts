import { createHash, randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import { eq, and, count, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { runTransaction } from '../db/utils.js';
import { apiKeys, apiKeyProjects, keyScopes } from '../db/schema/index.js';
import type { ApiKey, KeyScope, Role } from '../types.js';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createKey(
  label: string,
  role: Role,
  projectSlugs?: string[],
  expiresAt?: string,
  scopes?: { projectSlug: string; scopes: KeyScope[] }[],
): Promise<{ id: string; token: string }> {
  const id = randomUUID();
  const token = `ngw_${nanoid(40)}`;
  const keyHash = hashKey(token);
  const now = new Date().toISOString();

  await runTransaction(async (tx) => {
    await tx.insert(apiKeys).values({
      id,
      keyHash,
      label,
      role,
      createdAt: now,
      expiresAt: expiresAt ?? null,
    });

    if (projectSlugs && projectSlugs.length > 0) {
      for (const slug of projectSlugs) {
        await tx.insert(apiKeyProjects).values({ keyId: id, projectSlug: slug });
      }
    }

    if (role === 'custom' && scopes) {
      for (const entry of scopes) {
        for (const s of entry.scopes) {
          await tx.insert(keyScopes).values({
            keyId: id,
            projectSlug: entry.projectSlug,
            scope: s.scope,
            target: s.target,
          });
        }
      }
    }
  });

  return { id, token };
}

export async function validateKey(token: string): Promise<ApiKey | null> {
  const keyHash = hashKey(token);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  const projectRows = await db
    .select({ projectSlug: apiKeyProjects.projectSlug })
    .from(apiKeyProjects)
    .where(eq(apiKeyProjects.keyId, row.id));

  return {
    id: row.id,
    keyHash: row.keyHash,
    label: row.label,
    role: row.role as Role,
    projects: projectRows.map((p) => p.projectSlug),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

export async function revokeKey(id: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function listKeys(): Promise<Omit<ApiKey, 'keyHash'>[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      role: apiKeys.role,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .orderBy(apiKeys.createdAt);

  const result: Omit<ApiKey, 'keyHash'>[] = [];
  for (const row of rows) {
    const projectRows = await db
      .select({ projectSlug: apiKeyProjects.projectSlug })
      .from(apiKeyProjects)
      .where(eq(apiKeyProjects.keyId, row.id));

    result.push({
      id: row.id,
      label: row.label,
      role: row.role as Role,
      projects: projectRows.map((p) => p.projectSlug),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    });
  }

  return result;
}

export async function hasProjectAccess(keyId: string, projectSlug: string, role: Role): Promise<boolean> {
  const restrictions = await db
    .select({ value: count() })
    .from(apiKeyProjects)
    .where(eq(apiKeyProjects.keyId, keyId));

  if (role === 'admin' && restrictions[0].value === 0) return true;

  const access = await db
    .select({ keyId: apiKeyProjects.keyId })
    .from(apiKeyProjects)
    .where(and(eq(apiKeyProjects.keyId, keyId), eq(apiKeyProjects.projectSlug, projectSlug)));

  return access.length > 0;
}
