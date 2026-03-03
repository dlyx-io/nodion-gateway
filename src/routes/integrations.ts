import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { forwardToNodion } from '../proxy.js';
import { listProjects, getProject } from '../services/project-service.js';
import { listServiceAccounts } from '../services/service-account-service.js';
import { fetchWithSession } from '../services/nodion-session.js';

const tag = 'Integrations';

const integrations = new OpenAPIHono();

// ---------- Source tracking ----------

type ProjectSource = {
  type: 'project';
  projects: string[];      // slugs that share this integration
  apiKey: string;          // Nodion API key from the first project (for forwarding)
};

type ServiceAccountSource = {
  type: 'service-account';
  id: string;
  label: string;
};

type SourceInfo = ProjectSource | ServiceAccountSource;

let integrationCache: Map<string, SourceInfo> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

function isCacheValid(): boolean {
  return Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ---------- Helpers ----------

interface NodionIntegration {
  id: string;
  username?: string;
  service_type?: string;
  [key: string]: unknown;
}

async function getAccessibleProjectSlugs(apiKey: {
  id: string;
  role: string;
  projects: string[];
}): Promise<string[]> {
  if (apiKey.role === 'admin' && apiKey.projects.length === 0) {
    const all = await listProjects();
    return all.map((p) => p.slug);
  }
  return apiKey.projects;
}

async function fetchAndBuildCache(apiKey: {
  id: string;
  role: string;
  projects: string[];
}): Promise<
  {
    id: string;
    username?: string;
    service_type?: string;
    source: { type: string; projects?: string[]; id?: string; label?: string };
    syncable: boolean;
    [key: string]: unknown;
  }[]
> {
  const newCache = new Map<string, SourceInfo>();
  const resultMap = new Map<
    string,
    {
      integration: NodionIntegration;
      source: { type: string; projects?: string[]; id?: string; label?: string };
      syncable: boolean;
    }
  >();

  // 1. Fetch from project API keys
  const slugs = await getAccessibleProjectSlugs(apiKey);

  const projectResults = await Promise.allSettled(
    slugs.map(async (slug) => {
      const project = await getProject(slug);
      if (!project) return { slug, integrations: [] as NodionIntegration[] };

      const res = await forwardToNodion(
        project.nodionApiKeyEncrypted,
        '/integrations',
        'GET',
      );

      if (!res.ok) return { slug, integrations: [] as NodionIntegration[] };

      const body = await res.json() as { integrations?: NodionIntegration[]; data?: NodionIntegration[] };
      const list = body.integrations ?? body.data ?? (body as unknown as NodionIntegration[]);
      return {
        slug,
        apiKey: project.nodionApiKeyEncrypted,
        integrations: Array.isArray(list) ? list : [],
      };
    }),
  );

  for (const result of projectResults) {
    if (result.status !== 'fulfilled') continue;
    const { slug, integrations: ints, apiKey: projectApiKey } = result.value as {
      slug: string;
      integrations: NodionIntegration[];
      apiKey?: string;
    };

    for (const int of ints) {
      const existing = newCache.get(int.id);
      if (existing && existing.type === 'project') {
        // Merge: same integration visible from multiple projects
        existing.projects.push(slug);
      } else {
        newCache.set(int.id, {
          type: 'project',
          projects: [slug],
          apiKey: projectApiKey ?? '',
        });
      }

      const existingResult = resultMap.get(int.id);
      if (existingResult && existingResult.source.type === 'project') {
        existingResult.source.projects!.push(slug);
      } else {
        resultMap.set(int.id, {
          integration: int,
          source: { type: 'project', projects: [slug] },
          syncable: false,
        });
      }
    }
  }

  // 2. Fetch from service accounts
  const accounts = await listServiceAccounts();

  const accountResults = await Promise.allSettled(
    accounts.map(async (account) => {
      const res = await fetchWithSession(account.id, '/integrations', 'GET');
      if (!res.ok) return { account, integrations: [] as NodionIntegration[] };

      const body = await res.json() as { integrations?: NodionIntegration[]; data?: NodionIntegration[] };
      const list = body.integrations ?? body.data ?? (body as unknown as NodionIntegration[]);
      return {
        account,
        integrations: Array.isArray(list) ? list : [],
      };
    }),
  );

  for (const result of accountResults) {
    if (result.status !== 'fulfilled') continue;
    const { account, integrations: ints } = result.value;

    for (const int of ints) {
      // Service account integrations are distinct even if same ID exists from project keys
      // They use a different backend (/ui/v1 vs /v1), so we namespace the cache key
      const cacheKey = `sa:${int.id}`;
      newCache.set(cacheKey, {
        type: 'service-account',
        id: account.id,
        label: account.label,
      });

      // For the response, service account integrations may duplicate a project integration
      // We add them separately (different source type)
      resultMap.set(cacheKey, {
        integration: int,
        source: { type: 'service-account', id: account.id, label: account.label },
        syncable: true,
      });
    }
  }

  // Update cache
  integrationCache = newCache;
  cacheTimestamp = Date.now();

  // Build response array
  return Array.from(resultMap.values()).map(({ integration, source, syncable }) => ({
    ...integration,
    source,
    syncable,
  }));
}

function getSourceInfo(integrationId: string): { source: SourceInfo; cacheKey: string } | null {
  // Check service account source first (sa: prefix)
  const saKey = `sa:${integrationId}`;
  const saSource = integrationCache.get(saKey);
  if (saSource) return { source: saSource, cacheKey: saKey };

  // Check project source (bare ID)
  const projSource = integrationCache.get(integrationId);
  if (projSource) return { source: projSource, cacheKey: integrationId };

  return null;
}

// ---------- Schemas ----------

const integrationIdParam = z.object({
  integrationId: z.string().openapi({
    example: 'a97b4e56-1234-5678-9abc-def012345678',
    description: 'Integration UUID',
  }),
});

const integrationRepoParam = z.object({
  integrationId: z.string().openapi({ description: 'Integration UUID' }),
  repoId: z.string().openapi({ description: 'Repository UUID' }),
});

const jsonResponse = {
  200: {
    description: 'Successful response',
    content: { 'application/json': { schema: z.any() } },
  },
  400: {
    description: 'Bad request',
    content: { 'application/json': { schema: z.object({ error: z.string() }) } },
  },
  404: {
    description: 'Integration not found',
    content: { 'application/json': { schema: z.object({ error: z.string() }) } },
  },
};

// ---------- Routes ----------

// GET / — Aggregated list of all integrations
integrations.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: [tag],
    summary: 'List all integrations (aggregated)',
    description:
      'Returns integrations from all project API keys and service accounts. ' +
      'Project integrations are deduplicated by UUID. Service account integrations are syncable.',
    responses: {
      200: {
        description: 'Aggregated integrations',
        content: {
          'application/json': {
            schema: z.object({
              integrations: z.array(z.any()),
            }),
          },
        },
      },
    },
  }),
  (async (c: any) => {
    const apiKey = c.get('apiKey');
    const result = await fetchAndBuildCache(apiKey);
    return c.json({ integrations: result }, 200);
  }) as any,
);

// GET /:integrationId/repositories — List repos
integrations.openapi(
  createRoute({
    method: 'get',
    path: '/{integrationId}/repositories',
    tags: [tag],
    summary: 'List repositories for an integration',
    description: 'Routes to the correct backend (project API or service account session) based on integration source.',
    request: { params: integrationIdParam },
    responses: jsonResponse,
  }),
  (async (c: any) => {
    const { integrationId } = c.req.valid('param');

    // Refresh cache if stale
    if (!isCacheValid()) {
      const apiKey = c.get('apiKey');
      await fetchAndBuildCache(apiKey);
    }

    const info = getSourceInfo(integrationId);
    if (!info) {
      return c.json({ error: `Integration ${integrationId} not found. Call GET /api/integrations first to refresh the cache.` }, 404);
    }

    const path = `/integrations/${integrationId}/repositories`;

    if (info.source.type === 'service-account') {
      const res = await fetchWithSession(info.source.id, path, 'GET');
      const body = await res.text();
      return c.body(body, res.status as any, {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      });
    }

    // Project source — use the first project's API key
    const res = await forwardToNodion(info.source.apiKey, path, 'GET');
    const body = await res.text();
    return c.body(body, res.status as any, {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    });
  }) as any,
);

// GET /:integrationId/repositories/:repoId/branches — List branches
integrations.openapi(
  createRoute({
    method: 'get',
    path: '/{integrationId}/repositories/{repoId}/branches',
    tags: [tag],
    summary: 'List branches for a repository',
    description: 'Routes to the correct backend based on integration source.',
    request: { params: integrationRepoParam },
    responses: jsonResponse,
  }),
  (async (c: any) => {
    const { integrationId, repoId } = c.req.valid('param');

    if (!isCacheValid()) {
      const apiKey = c.get('apiKey');
      await fetchAndBuildCache(apiKey);
    }

    const info = getSourceInfo(integrationId);
    if (!info) {
      return c.json({ error: `Integration ${integrationId} not found. Call GET /api/integrations first to refresh the cache.` }, 404);
    }

    const path = `/integrations/${integrationId}/repositories/${repoId}/branches`;

    if (info.source.type === 'service-account') {
      const res = await fetchWithSession(info.source.id, path, 'GET');
      const body = await res.text();
      return c.body(body, res.status as any, {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      });
    }

    const res = await forwardToNodion(info.source.apiKey, path, 'GET');
    const body = await res.text();
    return c.body(body, res.status as any, {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    });
  }) as any,
);

// POST /:integrationId/sync_repos — Sync repo list (service accounts only)
integrations.openapi(
  createRoute({
    method: 'post',
    path: '/{integrationId}/sync_repos',
    tags: [tag],
    summary: 'Sync repository list for an integration',
    description: 'Only available for service account integrations (syncable: true). Returns 400 for project integrations.',
    request: { params: integrationIdParam },
    responses: jsonResponse,
  }),
  (async (c: any) => {
    const { integrationId } = c.req.valid('param');

    if (!isCacheValid()) {
      const apiKey = c.get('apiKey');
      await fetchAndBuildCache(apiKey);
    }

    const info = getSourceInfo(integrationId);
    if (!info) {
      return c.json({ error: `Integration ${integrationId} not found. Call GET /api/integrations first to refresh the cache.` }, 404);
    }

    if (info.source.type !== 'service-account') {
      return c.json(
        { error: 'Sync is only available for service account integrations (syncable: true). Project integrations cannot be synced via the gateway.' },
        400,
      );
    }

    const path = `/integrations/${integrationId}/sync_repos`;
    const res = await fetchWithSession(info.source.id, path, 'POST');
    const body = await res.text();
    return c.body(body, res.status as any, {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    });
  }) as any,
);

// POST /:integrationId/sync_repo — Sync branches for one repo (service accounts only)
integrations.openapi(
  createRoute({
    method: 'post',
    path: '/{integrationId}/sync_repo',
    tags: [tag],
    summary: 'Sync branches for a specific repository',
    description:
      'Only available for service account integrations (syncable: true). ' +
      'Body: { repository_id }. Returns 400 for project integrations.',
    request: {
      params: integrationIdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              repository_id: z.string().uuid().openapi({
                example: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
                description: 'Repository UUID to sync branches for',
              }),
            }),
          },
        },
      },
    },
    responses: jsonResponse,
  }),
  (async (c: any) => {
    const { integrationId } = c.req.valid('param');

    if (!isCacheValid()) {
      const apiKey = c.get('apiKey');
      await fetchAndBuildCache(apiKey);
    }

    const info = getSourceInfo(integrationId);
    if (!info) {
      return c.json({ error: `Integration ${integrationId} not found. Call GET /api/integrations first to refresh the cache.` }, 404);
    }

    if (info.source.type !== 'service-account') {
      return c.json(
        { error: 'Sync is only available for service account integrations (syncable: true). Project integrations cannot be synced via the gateway.' },
        400,
      );
    }

    const body = await c.req.json();
    const path = `/integrations/${integrationId}/sync_repo`;
    const res = await fetchWithSession(info.source.id, path, 'POST', body);
    const responseBody = await res.text();
    return c.body(responseBody, res.status as any, {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    });
  }) as any,
);

export { integrations };
