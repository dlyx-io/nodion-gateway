import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { projectMiddleware } from '../middleware/project.js';
import { auditMiddleware } from '../middleware/audit.js';
import { isAllowed } from '../services/role-service.js';
import { isBlocked } from '../services/blocklist-service.js';
import { isOwner, isTracked, trackResource, removeResource, updateLastDeployed } from '../services/ownership-service.js';
import { getRequiredScope, hasScope } from '../services/scope-service.js';
import { forwardToNodion } from '../proxy.js';

const proxy = new OpenAPIHono();

proxy.use('/projects/:slug/*', projectMiddleware);
proxy.use('/projects/:slug/*', auditMiddleware);

// --- Shared proxy handler ---

async function proxyHandler(c: Context): Promise<Response> {
  const apiKey = c.get('apiKey');
  const project = c.get('project');
  const nodionPath = c.get('nodionPath');
  const method = c.req.method;

  // Extract app ID from path
  const appIdMatch = nodionPath.match(/\/applications\/([a-f0-9-]+)/);
  const appId = appIdMatch ? appIdMatch[1] : null;

  if (apiKey.role === 'custom') {
    const { scope } = getRequiredScope(method, nodionPath);
    if (!(await hasScope(apiKey.id, project.slug, scope, appId))) {
      return c.json({ error: 'Forbidden: insufficient scope' }, 403);
    }
  } else {
    if (!isAllowed(apiKey.role, method, nodionPath)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // Ownership check: if a resource is tracked (created via gateway),
    // only the owning key can mutate it. Untracked resources (pre-existing
    // apps) are allowed through — the role check above already validated.
    if (appId && method !== 'GET' && apiKey.role !== 'admin') {
      if ((await isTracked(appId, project.slug)) && !(await isOwner(appId, project.slug, apiKey.id))) {
        return c.json({ error: 'Forbidden: you do not own this resource' }, 403);
      }
    }
  }

  if (appId && (await isBlocked(appId, project.slug))) {
    return c.json({ error: 'Forbidden: application is blocklisted' }, 403);
  }

  let body: string | null = null;
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    body = await c.req.text();
  }

  const response = await forwardToNodion(project.nodionApiKeyEncrypted, nodionPath, method, body);
  const responseBody = await response.text();

  if (method === 'POST' && nodionPath === '/applications' && response.ok) {
    try {
      const data = JSON.parse(responseBody);
      const newAppId = data.data?.id ?? data.id;
      const label = data.data?.name ?? data.name;
      if (newAppId) await trackResource(newAppId, project.slug, apiKey.id, label);
    } catch { /* ignore */ }
  }

  if (method === 'POST' && /^\/applications\/[^/]+\/deployments$/.test(nodionPath) && response.ok && appId) {
    await updateLastDeployed(appId, project.slug);
  }

  if (method === 'DELETE' && /^\/applications\/[^/]+$/.test(nodionPath) && response.ok && appId) {
    await removeResource(appId, project.slug);
  }

  return c.body(responseBody, response.status as any, {
    'Content-Type': response.headers.get('Content-Type') || 'application/json',
  });
}

// --- Common schemas ---

const slugParam = z.object({ slug: z.string().openapi({ example: 'control-center', description: 'Project slug' }) });
const appIdParam = z.object({ slug: z.string(), appId: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }) });
const appAndSubParam = z.object({ slug: z.string(), appId: z.string(), subId: z.string() });
const integrationIdParam = z.object({ slug: z.string(), integrationId: z.string().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }) });
const integrationRepoParam = z.object({ slug: z.string(), integrationId: z.string(), repoId: z.string() });

const jsonResponse = {
  200: {
    description: 'Proxied response from Nodion API',
    content: { 'application/json': { schema: z.any() } },
  },
  403: {
    description: 'Forbidden',
    content: { 'application/json': { schema: z.object({ error: z.string() }) } },
  },
};

const tag = 'Proxy — Applications';
const tagGit = 'Proxy — Git (Integrations / Repos / Branches)';
const tagEnv = 'Proxy — Environment Variables';
const tagDeploy = 'Proxy — Deployments';
const tagDomain = 'Proxy — Domains';
const tagInfra = 'Proxy — Infrastructure';

// --- Applications ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications',
  tags: [tag],
  summary: 'List all applications',
  request: { params: slugParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications',
  tags: [tag],
  summary: 'Create application',
  request: {
    params: slugParam,
    body: { content: { 'application/json': { schema: z.object({
      name: z.string().openapi({ example: 'my-app', description: 'Application name' }),
      region_id: z.string().uuid().openapi({ example: '428d037e-9ba6-4dab-92bd-8d816c523126', description: 'Region UUID (see GET /regions)' }),
      instance_type_id: z.string().uuid().openapi({ example: 'ccdcd297-702b-4f51-ad21-7ca481c08920', description: 'Instance type UUID (see GET /instance_types)' }),
      instance_amount: z.number().int().min(1).max(16).openapi({ example: 1, description: 'Number of instances (1–16)' }),
      integration_id: z.string().uuid().openapi({ description: 'Git integration UUID' }),
      repository_id: z.string().uuid().openapi({ description: 'Repository UUID' }),
      branch_id: z.string().uuid().openapi({ description: 'Branch UUID' }),
    }).passthrough() } } },
  },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}',
  tags: [tag],
  summary: 'Get application details',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'delete',
  path: '/projects/{slug}/applications/{appId}',
  tags: [tag],
  summary: 'Delete application',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Git: Integrations / Repositories / Branches ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/integrations',
  tags: [tagGit],
  summary: 'List Git integrations',
  description: 'Returns connected Git providers (e.g. GitHub). Use the integration ID to list repositories.',
  request: { params: slugParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/integrations/{integrationId}/repositories',
  tags: [tagGit],
  summary: 'List repositories for an integration',
  description: 'Returns repositories accessible via the given Git integration. Use the repository ID to list branches.',
  request: { params: integrationIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/integrations/{integrationId}/repositories/{repoId}/branches',
  tags: [tagGit],
  summary: 'List branches for a repository',
  description: 'Returns branches of a repository. Use the branch ID when creating an application.',
  request: { params: integrationRepoParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Deployments ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/deployments',
  tags: [tagDeploy],
  summary: 'List deployments',
  description: 'Status lifecycle: created → waiting → available | failed | expired',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/deployments',
  tags: [tagDeploy],
  summary: 'Trigger deployment (also works as restart)',
  description: 'Reuses existing image without rebuilding. Env vars are refreshed (except build-time).',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Environment Variables ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/env_variables',
  tags: [tagEnv],
  summary: 'List environment variables',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/env_variables/{subId}',
  tags: [tagEnv],
  summary: 'Get single environment variable',
  request: { params: appAndSubParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/env_variables',
  tags: [tagEnv],
  summary: 'Create environment variable',
  description: 'Body: { env_key, env_val, buildtime? }',
  request: {
    params: appIdParam,
    body: { content: { 'application/json': { schema: z.object({
      env_key: z.string().openapi({ example: 'DATABASE_URL' }),
      env_val: z.string().openapi({ example: 'postgres://...' }),
      buildtime: z.boolean().optional(),
    }).passthrough() } } },
  },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'patch',
  path: '/projects/{slug}/applications/{appId}/env_variables/{subId}',
  tags: [tagEnv],
  summary: 'Update environment variable',
  request: {
    params: appAndSubParam,
    body: { content: { 'application/json': { schema: z.object({
      env_key: z.string().optional(),
      env_val: z.string().optional(),
      buildtime: z.boolean().optional(),
    }).passthrough() } } },
  },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'delete',
  path: '/projects/{slug}/applications/{appId}/env_variables/{subId}',
  tags: [tagEnv],
  summary: 'Delete environment variable',
  request: { params: appAndSubParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Domains ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/domains',
  tags: [tagDomain],
  summary: 'List domains',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/domains',
  tags: [tagDomain],
  summary: 'Add domain',
  description: 'Body: { domain_name }',
  request: {
    params: appIdParam,
    body: { content: { 'application/json': { schema: z.object({
      domain_name: z.string().openapi({ example: 'app.example.com' }),
    }).passthrough() } } },
  },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/domains/{subId}/verify',
  tags: [tagDomain],
  summary: 'Verify domain',
  description: 'Verifies domain ownership via TXT DNS record',
  request: { params: appAndSubParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/domains/{subId}/connect',
  tags: [tagDomain],
  summary: 'Connect domain',
  description: 'Connects domain after CNAME/ALIAS DNS entry is set. Requires redeployment.',
  request: { params: appAndSubParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'delete',
  path: '/projects/{slug}/applications/{appId}/domains/{subId}',
  tags: [tagDomain],
  summary: 'Delete domain',
  request: { params: appAndSubParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Instances & Metrics ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/instances',
  tags: [tagInfra],
  summary: 'Get instance status',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/metrics',
  tags: [tagInfra],
  summary: 'Get CPU/RAM metrics',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Scaling ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/applications/{appId}/scaling_events',
  tags: [tagInfra],
  summary: 'List scaling events',
  request: { params: appIdParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'post',
  path: '/projects/{slug}/applications/{appId}/scaling_events',
  tags: [tagInfra],
  summary: 'Create scaling event',
  request: {
    params: appIdParam,
    body: { content: { 'application/json': { schema: z.object({
      instance_amount: z.number().int().min(1).max(16).openapi({ example: 2, description: 'Target number of instances (1–16)' }),
      instance_type_id: z.string().uuid().openapi({ description: 'Instance type UUID (use current if unchanged)' }),
      worker_id: z.string().uuid().optional().openapi({ description: 'Optional: target specific worker instead of whole app' }),
    }).passthrough() } } },
  },
  responses: jsonResponse,
}), proxyHandler as any);

// --- Regions & Instance Types ---

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/regions',
  tags: [tagInfra],
  summary: 'List available regions',
  request: { params: slugParam },
  responses: jsonResponse,
}), proxyHandler as any);

proxy.openapi(createRoute({
  method: 'get',
  path: '/projects/{slug}/instance_types',
  tags: [tagInfra],
  summary: 'List available instance types',
  request: { params: slugParam },
  responses: jsonResponse,
}), proxyHandler as any);

export { proxy };
