import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { runTransaction } from '../db/utils.js';
import { keyScopes } from '../db/schema/index.js';
import type { KeyScope, Scope } from '../types.js';

/**
 * Maps a (method, nodionPath) pair to the required scope and app ID.
 */
export function getRequiredScope(method: string, path: string): { scope: Scope | '_public'; appId: string | null } {
  const m = method.toUpperCase();

  // GET /regions, GET /instance_types, GET /integrations/* — always allowed
  if (m === 'GET' && (/^\/regions$/.test(path) || /^\/instance_types$/.test(path) || /^\/integrations(\/.*)?$/.test(path))) {
    return { scope: '_public', appId: null };
  }

  // POST /applications — create
  if (m === 'POST' && path === '/applications') {
    return { scope: 'create', appId: null };
  }

  // DELETE /applications/:id — delete
  if (m === 'DELETE' && /^\/applications\/[^/]+$/.test(path)) {
    return { scope: 'delete', appId: extractAppId(path) };
  }

  // POST /applications/:id/deployments — deploy
  if (m === 'POST' && /^\/applications\/[^/]+\/deployments$/.test(path)) {
    return { scope: 'deploy', appId: extractAppId(path) };
  }

  // GET /applications/:id/env_variables — env:read
  if (m === 'GET' && /^\/applications\/[^/]+\/env_variables(\/[^/]+)?$/.test(path)) {
    return { scope: 'env:read', appId: extractAppId(path) };
  }

  // POST /applications/:id/env_variables — env:write
  if (m === 'POST' && /^\/applications\/[^/]+\/env_variables$/.test(path)) {
    return { scope: 'env:write', appId: extractAppId(path) };
  }

  // PATCH /applications/:id/env_variables/:id — env:write
  if (m === 'PATCH' && /^\/applications\/[^/]+\/env_variables\/[^/]+$/.test(path)) {
    return { scope: 'env:write', appId: extractAppId(path) };
  }

  // DELETE /applications/:id/env_variables/:id — env:write
  if (m === 'DELETE' && /^\/applications\/[^/]+\/env_variables\/[^/]+$/.test(path)) {
    return { scope: 'env:write', appId: extractAppId(path) };
  }

  // GET/POST /applications/:id/scaling_events — scale
  if (/^\/applications\/[^/]+\/scaling_events$/.test(path)) {
    return { scope: 'scale', appId: extractAppId(path) };
  }

  // POST /applications/:id/domains — domain:write
  if (m === 'POST' && /^\/applications\/[^/]+\/domains$/.test(path)) {
    return { scope: 'domain:write', appId: extractAppId(path) };
  }

  // POST /applications/:id/domains/:id/verify — domain:write
  if (m === 'POST' && /^\/applications\/[^/]+\/domains\/[^/]+\/verify$/.test(path)) {
    return { scope: 'domain:write', appId: extractAppId(path) };
  }

  // POST /applications/:id/domains/:id/connect — domain:write
  if (m === 'POST' && /^\/applications\/[^/]+\/domains\/[^/]+\/connect$/.test(path)) {
    return { scope: 'domain:write', appId: extractAppId(path) };
  }

  // DELETE /applications/:id/domains/:id — domain:write
  if (m === 'DELETE' && /^\/applications\/[^/]+\/domains\/[^/]+$/.test(path)) {
    return { scope: 'domain:write', appId: extractAppId(path) };
  }

  // GET /applications (list all)
  if (m === 'GET' && path === '/applications') {
    return { scope: 'read', appId: null };
  }

  // GET /applications/:id and sub-resources (deployments, instances, metrics) — read
  if (m === 'GET' && /^\/applications\/[^/]+/.test(path)) {
    return { scope: 'read', appId: extractAppId(path) };
  }

  // Unknown endpoint — deny
  return { scope: 'manage', appId: null };
}

/**
 * Checks if a custom key has the required scope for the given app.
 */
export async function hasScope(keyId: string, projectSlug: string, scope: Scope | '_public', appId: string | null): Promise<boolean> {
  if (scope === '_public') return true;

  const rows = await db
    .select({ scope: keyScopes.scope, target: keyScopes.target })
    .from(keyScopes)
    .where(and(eq(keyScopes.keyId, keyId), eq(keyScopes.projectSlug, projectSlug)));

  // Lazy import to avoid circular dependency at module level
  const { isOwner } = await import('./ownership-service.js');

  for (const row of rows) {
    if (row.scope !== scope && row.scope !== 'manage') continue;
    if (scope === 'create') return true;
    if (row.target === '*') return true;
    if (row.target === 'owned' && appId && await isOwner(appId, projectSlug, keyId)) return true;
    if (appId && row.target === appId) return true;
  }

  return false;
}

/**
 * Stores scopes for a key in a specific project.
 */
export async function addScopes(keyId: string, projectSlug: string, scopes: KeyScope[]): Promise<void> {
  for (const s of scopes) {
    await db.insert(keyScopes).values({
      keyId,
      projectSlug,
      scope: s.scope,
      target: s.target,
    }).onConflictDoUpdate({
      target: [keyScopes.keyId, keyScopes.projectSlug, keyScopes.scope, keyScopes.target],
      set: { scope: s.scope },
    });
  }
}

/**
 * Gets all scopes for a key, optionally filtered by project.
 */
export async function getScopes(keyId: string, projectSlug?: string): Promise<(KeyScope & { projectSlug: string })[]> {
  const conditions = [eq(keyScopes.keyId, keyId)];
  if (projectSlug) {
    conditions.push(eq(keyScopes.projectSlug, projectSlug));
  }

  const rows = await db
    .select({
      scope: keyScopes.scope,
      target: keyScopes.target,
      projectSlug: keyScopes.projectSlug,
    })
    .from(keyScopes)
    .where(and(...conditions));

  return rows.map((row) => ({
    scope: row.scope as Scope,
    target: row.target,
    projectSlug: row.projectSlug,
  }));
}

/**
 * Removes all scopes for a key in a specific project.
 */
export async function removeScopes(keyId: string, projectSlug: string): Promise<void> {
  await db.delete(keyScopes).where(
    and(eq(keyScopes.keyId, keyId), eq(keyScopes.projectSlug, projectSlug))
  );
}

/**
 * Replaces all scopes for a key in a specific project.
 */
export async function replaceScopes(keyId: string, projectSlug: string, scopes: KeyScope[]): Promise<void> {
  await runTransaction(async (tx) => {
    await tx.delete(keyScopes).where(
      and(eq(keyScopes.keyId, keyId), eq(keyScopes.projectSlug, projectSlug))
    );
    for (const s of scopes) {
      await tx.insert(keyScopes).values({
        keyId,
        projectSlug,
        scope: s.scope,
        target: s.target,
      });
    }
  });
}

function extractAppId(path: string): string | null {
  const match = path.match(/\/applications\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}
