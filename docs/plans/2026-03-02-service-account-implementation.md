# Service Account Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional Nodion service accounts to the gateway, enabling `/ui/v1/` session-based access to integration sync and other endpoints not available via `/v1/`.

**Architecture:** New `service_accounts` DB table stores credentials. A session service manages `/ui/v1/` login and token rotation in-memory. A new `/api/integrations/*` route aggregates integrations from both project API keys (read-only) and service accounts (read + sync). Fully optional — gateway works unchanged without any service account.

**Tech Stack:** Drizzle ORM (dual-dialect SQLite/PostgreSQL), Hono + @hono/zod-openapi, `otpauth` for TOTP.

**Design doc:** `docs/plans/2026-03-02-service-account-integration-design.md`

---

## Task 1: Database Schema — `service_accounts` table

**Files:**
- Modify: `src/db/schema/sqlite.ts`
- Modify: `src/db/schema/postgres.ts`
- Modify: `src/db/schema/index.ts`

**Step 1: Add table to SQLite schema**

In `src/db/schema/sqlite.ts`, add after the `auditLog` table:

```typescript
export const serviceAccounts = sqliteTable('service_accounts', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  email: text('email').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  createdAt: text('created_at').notNull(),
});
```

**Step 2: Add table to PostgreSQL schema**

In `src/db/schema/postgres.ts`, add the same table using `pgTable`:

```typescript
export const serviceAccounts = pgTable('service_accounts', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  email: text('email').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  createdAt: text('created_at').notNull(),
});
```

**Step 3: Export from schema index**

In `src/db/schema/index.ts`, add `serviceAccounts` to the destructured export:

```typescript
export const {
  projects,
  apiKeys,
  apiKeyProjects,
  resources,
  blocklist,
  keyScopes,
  auditLog,
  serviceAccounts,
} = schema;
```

**Step 4: Generate and apply migration**

Run: `npx drizzle-kit generate`

This creates a migration file in `drizzle/sqlite/` and/or `drizzle/pg/`. The migration runs automatically on gateway startup via `runMigrations()`.

**Step 5: Commit**

```bash
git add src/db/schema/ drizzle/
git commit -m "feat: add service_accounts table for /ui/v1/ session auth"
```

---

## Task 2: Type Definition — `ServiceAccount`

**Files:**
- Modify: `src/types.ts`

**Step 1: Add ServiceAccount interface**

At the end of `src/types.ts`:

```typescript
export interface ServiceAccount {
  id: string;
  label: string;
  email: string;
  passwordEncrypted: string;
  totpSecretEncrypted: string | null;
  createdAt: string;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ServiceAccount type"
```

---

## Task 3: Service — `service-account-service.ts`

**Files:**
- Create: `src/services/service-account-service.ts`
- Test: `tests/service-account-service.test.ts`

**Step 1: Write the test**

Create `tests/service-account-service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Service account service is pure CRUD — tests verify the public API shape.
// Full integration tests require a DB, so we test the session service separately.
// Here we verify the module exports the expected functions.

describe('service-account-service', () => {
  it('exports expected functions', async () => {
    const mod = await import('../src/services/service-account-service.js');
    expect(typeof mod.createServiceAccount).toBe('function');
    expect(typeof mod.listServiceAccounts).toBe('function');
    expect(typeof mod.getServiceAccount).toBe('function');
    expect(typeof mod.updateServiceAccount).toBe('function');
    expect(typeof mod.deleteServiceAccount).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/service-account-service.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the service**

Create `src/services/service-account-service.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { serviceAccounts } from '../db/schema/index.js';
import type { ServiceAccount } from '../types.js';

export async function createServiceAccount(
  label: string,
  email: string,
  password: string,
  totpSecret?: string,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(serviceAccounts).values({
    id,
    label,
    email,
    passwordEncrypted: password, // TODO: encrypt when encryption is added
    totpSecretEncrypted: totpSecret ?? null,
    createdAt: new Date().toISOString(),
  });
  return { id };
}

export async function listServiceAccounts(): Promise<Omit<ServiceAccount, 'passwordEncrypted' | 'totpSecretEncrypted'>[]> {
  const rows = await db.select({
    id: serviceAccounts.id,
    label: serviceAccounts.label,
    email: serviceAccounts.email,
    createdAt: serviceAccounts.createdAt,
  }).from(serviceAccounts).orderBy(serviceAccounts.createdAt);
  return rows;
}

export async function getServiceAccount(id: string): Promise<ServiceAccount | null> {
  const rows = await db.select().from(serviceAccounts).where(eq(serviceAccounts.id, id));
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    label: row.label,
    email: row.email,
    passwordEncrypted: row.passwordEncrypted,
    totpSecretEncrypted: row.totpSecretEncrypted,
    createdAt: row.createdAt,
  };
}

export async function updateServiceAccount(
  id: string,
  updates: { label?: string; password?: string; totpSecret?: string | null },
): Promise<boolean> {
  const set: Record<string, string | null> = {};
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.password !== undefined) set.passwordEncrypted = updates.password;
  if (updates.totpSecret !== undefined) set.totpSecretEncrypted = updates.totpSecret;
  if (Object.keys(set).length === 0) return false;

  const result = await db.update(serviceAccounts).set(set).where(eq(serviceAccounts.id, id));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

export async function deleteServiceAccount(id: string): Promise<boolean> {
  const result = await db.delete(serviceAccounts).where(eq(serviceAccounts.id, id));
  return (result.changes ?? result.rowCount ?? 0) > 0;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/service-account-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/service-account-service.ts tests/service-account-service.test.ts
git commit -m "feat: add service-account-service with CRUD operations"
```

---

## Task 4: Admin Routes — Service Account CRUD

**Files:**
- Modify: `src/routes/admin.ts`

**Step 1: Add POST /admin/service-accounts**

Add imports and routes in `src/routes/admin.ts`. Tag: `'Admin — Service Accounts'`.

```typescript
import * as serviceAccountService from '../services/service-account-service.js';

const createServiceAccountRoute = createRoute({
  method: 'post',
  path: '/service-accounts',
  tags: ['Admin — Service Accounts'],
  summary: 'Create a service account',
  description: 'Store Nodion user credentials for /ui/v1/ session access (integration sync, etc.)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().min(1).openapi({ example: 'dlyx Integration Account' }),
            email: z.string().email().openapi({ example: 'service@example.com' }),
            password: z.string().min(1),
            totpSecret: z.string().optional().openapi({ description: 'TOTP seed for 2FA (optional)' }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Service account created',
      content: { 'application/json': { schema: z.object({ id: z.string(), label: z.string(), email: z.string() }) } },
    },
  },
});

admin.openapi(createServiceAccountRoute, async (c) => {
  const { label, email, password, totpSecret } = c.req.valid('json');
  const { id } = await serviceAccountService.createServiceAccount(label, email, password, totpSecret);
  return c.json({ id, label, email }, 201);
});
```

**Step 2: Add GET /admin/service-accounts**

```typescript
const listServiceAccountsRoute = createRoute({
  method: 'get',
  path: '/service-accounts',
  tags: ['Admin — Service Accounts'],
  summary: 'List service accounts',
  description: 'Returns id, label, email. No credentials.',
  responses: {
    200: {
      description: 'List of service accounts',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            label: z.string(),
            email: z.string(),
            createdAt: z.string(),
          })),
        },
      },
    },
  },
});

admin.openapi(listServiceAccountsRoute, async (c) => {
  const accounts = await serviceAccountService.listServiceAccounts();
  return c.json(accounts, 200);
});
```

**Step 3: Add PATCH /admin/service-accounts/:id**

```typescript
const updateServiceAccountRoute = createRoute({
  method: 'patch',
  path: '/service-accounts/{id}',
  tags: ['Admin — Service Accounts'],
  summary: 'Update a service account',
  description: 'Update label, password, or TOTP secret. Credentials are write-only.',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().min(1).optional(),
            password: z.string().min(1).optional(),
            totpSecret: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Service account updated',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Service account not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(updateServiceAccountRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const updated = await serviceAccountService.updateServiceAccount(id, body);
  if (!updated) return c.json({ error: 'Service account not found or no changes' }, 404);
  return c.json({ success: true }, 200);
});
```

**Step 4: Add DELETE /admin/service-accounts/:id**

```typescript
const deleteServiceAccountRoute = createRoute({
  method: 'delete',
  path: '/service-accounts/{id}',
  tags: ['Admin — Service Accounts'],
  summary: 'Delete a service account',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Service account deleted',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Service account not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(deleteServiceAccountRoute, async (c) => {
  const { id } = c.req.valid('param');
  const deleted = await serviceAccountService.deleteServiceAccount(id);
  if (!deleted) return c.json({ error: 'Service account not found' }, 404);
  return c.json({ success: true }, 200);
});
```

**Step 5: Build and verify**

Run: `npm run build`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/routes/admin.ts
git commit -m "feat: add admin CRUD endpoints for service accounts"
```

---

## Task 5: Session Service — `nodion-session.ts`

**Files:**
- Create: `src/services/nodion-session.ts`
- Test: `tests/nodion-session.test.ts`

**Step 1: Write the test**

Create `tests/nodion-session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('nodion-session', () => {
  it('exports fetchWithSession function', async () => {
    const mod = await import('../src/services/nodion-session.js');
    expect(typeof mod.fetchWithSession).toBe('function');
  });

  it('exports clearSession function', async () => {
    const mod = await import('../src/services/nodion-session.js');
    expect(typeof mod.clearSession).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nodion-session.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the session service**

Create `src/services/nodion-session.ts`:

```typescript
import { getServiceAccount } from './service-account-service.js';

const NODION_UI_BASE = 'https://api.nodion.com/ui/v1';

interface SessionTokens {
  accessToken: string;
  tokenType: string;
  client: string;
  expiry: string;
  uid: string;
}

// In-memory session store: accountId → tokens
const sessions = new Map<string, SessionTokens>();

async function login(accountId: string): Promise<SessionTokens> {
  const account = await getServiceAccount(accountId);
  if (!account) throw new Error(`Service account ${accountId} not found`);

  const body: Record<string, string> = {
    email: account.email,
    password: account.passwordEncrypted, // TODO: decrypt when encryption is added
  };

  // TOTP support: compute 6-digit code if secret is available
  if (account.totpSecretEncrypted) {
    try {
      const { TOTP } = await import('otpauth');
      const totp = new TOTP({ secret: account.totpSecretEncrypted });
      body.otp = totp.generate();
    } catch {
      // otpauth not installed — skip TOTP
    }
  }

  const response = await fetch(`${NODION_UI_BASE}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Nodion login failed for ${account.email}: ${response.status} ${text}`);
  }

  const tokens = extractTokens(response.headers);
  if (!tokens) throw new Error(`No auth tokens in login response for ${account.email}`);

  sessions.set(accountId, tokens);
  return tokens;
}

function extractTokens(headers: Headers): SessionTokens | null {
  const accessToken = headers.get('access-token');
  const tokenType = headers.get('token-type');
  const client = headers.get('client');
  const expiry = headers.get('expiry');
  const uid = headers.get('uid');

  if (!accessToken || !client || !expiry || !uid) return null;

  return { accessToken, tokenType: tokenType ?? 'Bearer', client, expiry, uid };
}

function makeHeaders(tokens: SessionTokens): Record<string, string> {
  return {
    'access-token': tokens.accessToken,
    'token-type': tokens.tokenType,
    'client': tokens.client,
    'expiry': tokens.expiry,
    'uid': tokens.uid,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export async function fetchWithSession(
  accountId: string,
  path: string,
  method: string = 'GET',
  body?: object,
): Promise<Response> {
  // Get or create session
  let tokens = sessions.get(accountId);
  if (!tokens) {
    tokens = await login(accountId);
  }

  // Make request
  let response = await fetch(`${NODION_UI_BASE}${path}`, {
    method,
    headers: makeHeaders(tokens),
    body: body ? JSON.stringify(body) : undefined,
  });

  // Rotate tokens from response headers
  const newTokens = extractTokens(response.headers);
  if (newTokens) {
    sessions.set(accountId, newTokens);
  }

  // Auto re-auth on 401 (1x retry)
  if (response.status === 401) {
    tokens = await login(accountId);
    response = await fetch(`${NODION_UI_BASE}${path}`, {
      method,
      headers: makeHeaders(tokens),
      body: body ? JSON.stringify(body) : undefined,
    });

    const retryTokens = extractTokens(response.headers);
    if (retryTokens) {
      sessions.set(accountId, retryTokens);
    }
  }

  return response;
}

export function clearSession(accountId: string): void {
  sessions.delete(accountId);
}

export function clearAllSessions(): void {
  sessions.clear();
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nodion-session.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/nodion-session.ts tests/nodion-session.test.ts
git commit -m "feat: add Nodion session service for /ui/v1/ auth with token rotation"
```

---

## Task 6: Integrations Route — Aggregation + Routing

**Files:**
- Create: `src/routes/integrations.ts`
- Modify: `src/app.ts`

This is the core of the feature. The route aggregates integrations from all sources and routes sub-requests to the correct backend.

**Step 1: Create the integrations route**

Create `src/routes/integrations.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { forwardToNodion } from '../proxy.js';
import { listProjects, getProject } from '../services/project-service.js';
import { listServiceAccounts } from '../services/service-account-service.js';
import { fetchWithSession } from '../services/nodion-session.js';

const integrations = new OpenAPIHono();
const tag = 'Integrations';

// In-memory lookup: integration_id → source info
interface IntegrationSource {
  type: 'project';
  projects: string[];
} | {
  type: 'service-account';
  accountId: string;
  label: string;
}

let sourceMap = new Map<string, IntegrationSource>();
let sourceMapAge = 0;
const SOURCE_MAP_TTL = 60_000; // 1 minute

async function refreshSourceMap(apiKeyProjects: string[]): Promise<void> {
  const now = Date.now();
  if (now - sourceMapAge < SOURCE_MAP_TTL && sourceMap.size > 0) return;

  const newMap = new Map<string, IntegrationSource>();

  // 1. Project integrations via /v1/
  const allProjects = await listProjects();
  const accessibleProjects = apiKeyProjects.length > 0
    ? allProjects.filter(p => apiKeyProjects.includes(p.slug))
    : allProjects;

  for (const project of accessibleProjects) {
    const full = await getProject(project.slug);
    if (!full) continue;
    try {
      const response = await forwardToNodion(full.nodionApiKeyEncrypted, '/integrations', 'GET');
      if (response.ok) {
        const data = await response.json() as { integrations: Array<{ id: string }> };
        for (const integration of data.integrations ?? []) {
          const existing = newMap.get(integration.id);
          if (existing && existing.type === 'project') {
            existing.projects.push(project.slug);
          } else {
            newMap.set(integration.id, { type: 'project', projects: [project.slug] });
          }
        }
      }
    } catch { /* skip unavailable projects */ }
  }

  // 2. Service account integrations via /ui/v1/
  const accounts = await listServiceAccounts();
  for (const account of accounts) {
    try {
      const response = await fetchWithSession(account.id, '/integrations');
      if (response.ok) {
        const data = await response.json() as { integrations: Array<{ id: string }> };
        for (const integration of data.integrations ?? []) {
          newMap.set(integration.id, {
            type: 'service-account',
            accountId: account.id,
            label: account.label,
          });
        }
      }
    } catch { /* skip unavailable accounts */ }
  }

  sourceMap = newMap;
  sourceMapAge = now;
}

// GET /integrations — aggregated list
integrations.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: [tag],
  summary: 'List all integrations',
  description: 'Aggregates integrations from project API keys (read-only) and service accounts (syncable).',
  responses: {
    200: {
      description: 'Aggregated integrations',
      content: { 'application/json': { schema: z.any() } },
    },
  },
}), async (c) => {
  const apiKey = c.get('apiKey');
  await refreshSourceMap(apiKey.projects);

  const result: Array<Record<string, unknown>> = [];
  const allProjects = await listProjects();
  const accessibleProjects = apiKey.role === 'admin' && apiKey.projects.length === 0
    ? allProjects.map(p => p.slug)
    : apiKey.projects;

  // Collect project integrations
  const projectIntegrations = new Map<string, { integration: Record<string, unknown>; projects: string[] }>();
  for (const slug of accessibleProjects) {
    const project = await getProject(slug);
    if (!project) continue;
    try {
      const response = await forwardToNodion(project.nodionApiKeyEncrypted, '/integrations', 'GET');
      if (!response.ok) continue;
      const data = await response.json() as { integrations: Array<Record<string, unknown>> };
      for (const integration of data.integrations ?? []) {
        const id = integration.id as string;
        const existing = projectIntegrations.get(id);
        if (existing) {
          existing.projects.push(slug);
        } else {
          projectIntegrations.set(id, { integration, projects: [slug] });
        }
      }
    } catch { /* skip */ }
  }

  for (const [, { integration, projects }] of projectIntegrations) {
    result.push({
      ...integration,
      source: { type: 'project', projects },
      syncable: false,
    });
  }

  // Collect service account integrations
  const accounts = await listServiceAccounts();
  for (const account of accounts) {
    try {
      const response = await fetchWithSession(account.id, '/integrations');
      if (!response.ok) continue;
      const data = await response.json() as { integrations: Array<Record<string, unknown>> };
      for (const integration of data.integrations ?? []) {
        result.push({
          ...integration,
          source: { type: 'service-account', id: account.id, label: account.label },
          syncable: true,
        });
      }
    } catch { /* skip */ }
  }

  return c.json({ integrations: result }, 200);
});

// Helper: find source for an integration ID
async function findSource(integrationId: string, apiKeyProjects: string[]): Promise<IntegrationSource | null> {
  if (sourceMap.size === 0 || Date.now() - sourceMapAge > SOURCE_MAP_TTL) {
    await refreshSourceMap(apiKeyProjects);
  }
  return sourceMap.get(integrationId) ?? null;
}

// GET /integrations/:id/repositories
integrations.openapi(createRoute({
  method: 'get',
  path: '/{integrationId}/repositories',
  tags: [tag],
  summary: 'List repositories for an integration',
  request: { params: z.object({ integrationId: z.string() }) },
  responses: {
    200: { description: 'Repositories', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Integration not found', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
}), async (c) => {
  const { integrationId } = c.req.valid('param');
  const apiKey = c.get('apiKey');
  const source = await findSource(integrationId, apiKey.projects);

  if (!source) return c.json({ error: 'Integration not found' }, 404);

  if (source.type === 'service-account') {
    const response = await fetchWithSession(source.accountId, `/integrations/${integrationId}/repositories`);
    const data = await response.json();
    return c.json(data, response.status as 200);
  }

  // Project source — use first project's API key
  const project = await getProject(source.projects[0]);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  const response = await forwardToNodion(project.nodionApiKeyEncrypted, `/integrations/${integrationId}/repositories`, 'GET');
  const data = await response.json();
  return c.json(data, response.status as 200);
});

// GET /integrations/:id/repositories/:repoId/branches
integrations.openapi(createRoute({
  method: 'get',
  path: '/{integrationId}/repositories/{repoId}/branches',
  tags: [tag],
  summary: 'List branches for a repository',
  request: { params: z.object({ integrationId: z.string(), repoId: z.string() }) },
  responses: {
    200: { description: 'Branches', content: { 'application/json': { schema: z.any() } } },
    404: { description: 'Integration not found', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
}), async (c) => {
  const { integrationId, repoId } = c.req.valid('param');
  const apiKey = c.get('apiKey');
  const source = await findSource(integrationId, apiKey.projects);

  if (!source) return c.json({ error: 'Integration not found' }, 404);

  if (source.type === 'service-account') {
    const response = await fetchWithSession(source.accountId, `/integrations/${integrationId}/repositories/${repoId}/branches`);
    const data = await response.json();
    return c.json(data, response.status as 200);
  }

  const project = await getProject(source.projects[0]);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  const response = await forwardToNodion(project.nodionApiKeyEncrypted, `/integrations/${integrationId}/repositories/${repoId}/branches`, 'GET');
  const data = await response.json();
  return c.json(data, response.status as 200);
});

// POST /integrations/:id/sync_repos — sync repository list (service accounts only)
integrations.openapi(createRoute({
  method: 'post',
  path: '/{integrationId}/sync_repos',
  tags: [tag],
  summary: 'Sync repository list',
  description: 'Triggers a repo sync on the Git provider. Only available for service-account integrations (syncable: true).',
  request: { params: z.object({ integrationId: z.string() }) },
  responses: {
    200: { description: 'Sync result', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Not syncable', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    404: { description: 'Integration not found', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
}), async (c) => {
  const { integrationId } = c.req.valid('param');
  const apiKey = c.get('apiKey');
  const source = await findSource(integrationId, apiKey.projects);

  if (!source) return c.json({ error: 'Integration not found' }, 404);
  if (source.type !== 'service-account') {
    return c.json({ error: 'This integration is not syncable. Only service-account integrations support sync.' }, 400);
  }

  const response = await fetchWithSession(source.accountId, `/integrations/${integrationId}/sync_repos`, 'POST');
  const data = await response.json();
  return c.json(data, response.status as 200);
});

// POST /integrations/:id/sync_repo — sync branches for a single repo (service accounts only)
integrations.openapi(createRoute({
  method: 'post',
  path: '/{integrationId}/sync_repo',
  tags: [tag],
  summary: 'Sync branches for a repository',
  description: 'Triggers a branch sync for a specific repository. Only available for service-account integrations.',
  request: {
    params: z.object({ integrationId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            repository_id: z.string().uuid().openapi({ description: 'Repository UUID to sync branches for' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Sync result', content: { 'application/json': { schema: z.any() } } },
    400: { description: 'Not syncable', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    404: { description: 'Integration not found', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
}), async (c) => {
  const { integrationId } = c.req.valid('param');
  const apiKey = c.get('apiKey');
  const source = await findSource(integrationId, apiKey.projects);

  if (!source) return c.json({ error: 'Integration not found' }, 404);
  if (source.type !== 'service-account') {
    return c.json({ error: 'This integration is not syncable. Only service-account integrations support sync.' }, 400);
  }

  const body = c.req.valid('json');
  const response = await fetchWithSession(source.accountId, `/integrations/${integrationId}/sync_repo`, 'POST', body);
  const data = await response.json();
  return c.json(data, response.status as 200);
});

export { integrations };
```

**Step 2: Mount the route in app.ts**

In `src/app.ts`, add:

```typescript
import { integrations } from './routes/integrations.js';

// After existing auth middleware lines:
api.use('/integrations/*', authMiddleware);

// After existing route mounts:
api.route('/integrations', integrations);
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/routes/integrations.ts src/app.ts
git commit -m "feat: add /api/integrations/* routes with aggregation and sync"
```

---

## Task 7: Install `otpauth` dependency

**Step 1: Install**

Run: `npm install otpauth`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add otpauth dependency for TOTP support"
```

---

## Task 8: Build, Test, Verify

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

**Step 2: Full build**

Run: `npm run build`
Expected: No errors.

**Step 3: Start dev server and smoke test**

Run: `npm run dev`

Then test the new endpoints:

```bash
# Create a service account
curl -X POST http://localhost:3000/api/admin/service-accounts \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"label":"Test Account","email":"test@example.com","password":"secret"}'

# List service accounts
curl http://localhost:3000/api/admin/service-accounts \
  -H "Authorization: Bearer <admin-key>"

# List integrations (aggregated)
curl http://localhost:3000/api/integrations \
  -H "Authorization: Bearer <any-key>"

# Check OpenAPI spec includes new endpoints
curl http://localhost:3000/api/openapi.json | jq '.paths | keys[]' | grep -E 'service-accounts|integrations'
```

**Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add service account documentation**

Add to the relevant sections in CLAUDE.md:

- **Project Structure**: Add `src/services/nodion-session.ts` and `src/routes/integrations.ts`
- **Database Tables**: Add `service_accounts` table
- **API Reference > Admin Endpoints**: Add service-accounts CRUD
- **API Reference > Public Endpoints**: Add `/integrations/*` routes
- **Configuration**: Note that service accounts are optional and managed via admin API

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add service account and integrations documentation to CLAUDE.md"
```

---

## Summary

| Task | Files | What |
|------|-------|------|
| 1 | schema/sqlite.ts, schema/postgres.ts, schema/index.ts | `service_accounts` table |
| 2 | types.ts | `ServiceAccount` interface |
| 3 | service-account-service.ts + test | CRUD service |
| 4 | admin.ts | Admin endpoints |
| 5 | nodion-session.ts + test | `/ui/v1/` session management |
| 6 | integrations.ts, app.ts | Aggregation route + mounting |
| 7 | package.json | `otpauth` dependency |
| 8 | — | Build, test, smoke test |
| 9 | CLAUDE.md | Documentation |
