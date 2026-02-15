import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { adminOnly } from '../middleware/auth.js';
import * as projectService from '../services/project-service.js';
import * as keyService from '../services/key-service.js';
import * as ownershipService from '../services/ownership-service.js';
import * as blocklistService from '../services/blocklist-service.js';
import * as auditService from '../services/audit-service.js';
import * as scopeService from '../services/scope-service.js';

const admin = new OpenAPIHono();

admin.use('/*', adminOnly);

// --- Project Management ---

const createProjectRoute = createRoute({
  method: 'post',
  path: '/projects',
  tags: ['Admin — Projects'],
  summary: 'Create a project',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            slug: z.string().regex(/^[a-z0-9-]+$/).openapi({ example: 'control-center' }),
            label: z.string().min(1).openapi({ example: 'DLYX Control Center' }),
            nodionApiKey: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Project created',
      content: { 'application/json': { schema: z.object({ slug: z.string(), label: z.string() }) } },
    },
    409: {
      description: 'Project already exists',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(createProjectRoute, async (c) => {
  const { slug, label, nodionApiKey } = c.req.valid('json');
  try {
    await projectService.createProject(slug, label, nodionApiKey);
    return c.json({ slug, label }, 201);
  } catch {
    return c.json({ error: `Project '${slug}' already exists` }, 409);
  }
});

const listProjectsRoute = createRoute({
  method: 'get',
  path: '/projects',
  tags: ['Admin — Projects'],
  summary: 'List all projects',
  responses: {
    200: {
      description: 'List of projects',
      content: {
        'application/json': {
          schema: z.array(z.object({ slug: z.string(), label: z.string(), createdAt: z.string() })),
        },
      },
    },
  },
});

admin.openapi(listProjectsRoute, async (c) => {
  const projects = await projectService.listProjects();
  return c.json(projects, 200);
});

const getProjectRoute = createRoute({
  method: 'get',
  path: '/projects/{slug}',
  tags: ['Admin — Projects'],
  summary: 'Get project details',
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: 'Project details',
      content: {
        'application/json': {
          schema: z.object({ slug: z.string(), label: z.string(), createdAt: z.string() }),
        },
      },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(getProjectRoute, async (c) => {
  const { slug } = c.req.valid('param');
  const project = await projectService.getProject(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json({ slug: project.slug, label: project.label, createdAt: project.createdAt }, 200);
});

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/projects/{slug}',
  tags: ['Admin — Projects'],
  summary: 'Update a project',
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().min(1).optional(),
            nodionApiKey: z.string().min(1).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Project updated',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(updateProjectRoute, async (c) => {
  const { slug } = c.req.valid('param');
  const body = c.req.valid('json');
  const updated = await projectService.updateProject(slug, body);
  if (!updated) return c.json({ error: 'Project not found or no changes' }, 404);
  return c.json({ success: true }, 200);
});

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/projects/{slug}',
  tags: ['Admin — Projects'],
  summary: 'Delete a project',
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: 'Project deleted',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(deleteProjectRoute, async (c) => {
  const { slug } = c.req.valid('param');
  const deleted = await projectService.deleteProject(slug);
  if (!deleted) return c.json({ error: 'Project not found' }, 404);
  return c.json({ success: true }, 200);
});

// --- Key Management ---

const scopeSchema = z.object({
  scope: z.enum(['read', 'env:read', 'env:write', 'deploy', 'scale', 'create', 'delete', 'domain:write', 'manage']),
  target: z.string().default('*').openapi({ example: '*', description: 'App ID, "owned", or "*"' }),
});

const projectScopesSchema = z.object({
  projectSlug: z.string(),
  scopes: z.array(scopeSchema),
});

const createKeyRoute = createRoute({
  method: 'post',
  path: '/keys',
  tags: ['Admin — Keys'],
  summary: 'Create an API key',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().min(1).openapi({ example: 'DLYX Agent' }),
            role: z.enum(['admin', 'agent', 'deployer', 'readonly', 'custom']),
            projects: z.array(z.string()).optional().openapi({ example: ['control-center'] }),
            expiresAt: z.string().datetime().optional(),
            scopes: z.array(projectScopesSchema).optional().openapi({
              description: 'Fine-grained scopes (required for role "custom")',
            }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'API key created (token shown only once)',
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), token: z.string(), label: z.string(), role: z.string() }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(createKeyRoute, async (c) => {
  const { label, role, projects, expiresAt, scopes } = c.req.valid('json');

  if (role === 'custom' && (!scopes || scopes.length === 0)) {
    return c.json({ error: 'Scopes are required for custom role' }, 400);
  }

  const { id, token } = await keyService.createKey(label, role, projects, expiresAt, scopes);
  return c.json({ id, token, label, role }, 201);
});

const listKeysRoute = createRoute({
  method: 'get',
  path: '/keys',
  tags: ['Admin — Keys'],
  summary: 'List all API keys',
  responses: {
    200: {
      description: 'List of keys',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            label: z.string(),
            role: z.string(),
            projects: z.array(z.string()),
            createdAt: z.string(),
            expiresAt: z.string().nullable(),
            revokedAt: z.string().nullable(),
          })),
        },
      },
    },
  },
});

admin.openapi(listKeysRoute, async (c) => {
  const keys = await keyService.listKeys();
  // Enrich custom keys with their scopes
  const enriched = [];
  for (const key of keys) {
    if (key.role === 'custom') {
      const scopes = await scopeService.getScopes(key.id);
      enriched.push({ ...key, scopes });
    } else {
      enriched.push({ ...key, scopes: [] });
    }
  }
  return c.json(enriched, 200);
});

const revokeKeyRoute = createRoute({
  method: 'delete',
  path: '/keys/{id}',
  tags: ['Admin — Keys'],
  summary: 'Revoke an API key',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Key revoked',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Key not found',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(revokeKeyRoute, async (c) => {
  const { id } = c.req.valid('param');
  const revoked = await keyService.revokeKey(id);
  if (!revoked) return c.json({ error: 'Key not found or already revoked' }, 404);
  return c.json({ success: true }, 200);
});

// --- Scopes ---

const getScopesRoute = createRoute({
  method: 'get',
  path: '/keys/{id}/scopes',
  tags: ['Admin — Keys'],
  summary: 'Get scopes for a key',
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ project: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Key scopes',
      content: {
        'application/json': {
          schema: z.array(z.object({
            scope: z.string(),
            target: z.string(),
            projectSlug: z.string(),
          })),
        },
      },
    },
  },
});

admin.openapi(getScopesRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { project } = c.req.valid('query');
  const scopes = await scopeService.getScopes(id, project);
  return c.json(scopes, 200);
});

const replaceScopesRoute = createRoute({
  method: 'put',
  path: '/keys/{id}/scopes/{projectSlug}',
  tags: ['Admin — Keys'],
  summary: 'Replace scopes for a key in a project',
  request: {
    params: z.object({ id: z.string(), projectSlug: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            scopes: z.array(scopeSchema),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Scopes replaced',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
  },
});

admin.openapi(replaceScopesRoute, async (c) => {
  const { id, projectSlug } = c.req.valid('param');
  const { scopes } = c.req.valid('json');
  await scopeService.replaceScopes(id, projectSlug, scopes);
  return c.json({ success: true }, 200);
});

// --- Resources ---

const listResourcesRoute = createRoute({
  method: 'get',
  path: '/resources',
  tags: ['Admin — Resources'],
  summary: 'List tracked resources',
  request: {
    query: z.object({ project: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'List of tracked resources',
      content: {
        'application/json': {
          schema: z.array(z.object({
            appId: z.string(),
            projectSlug: z.string(),
            createdByKey: z.string(),
            createdAt: z.string(),
            label: z.string().nullable(),
            lastDeployedAt: z.string().nullable(),
          })),
        },
      },
    },
  },
});

admin.openapi(listResourcesRoute, async (c) => {
  const { project } = c.req.valid('query');
  const resources = await ownershipService.getResources(project);
  return c.json(resources, 200);
});

// --- Blocklist ---

const addToBlocklistRoute = createRoute({
  method: 'post',
  path: '/blocklist',
  tags: ['Admin — Blocklist'],
  summary: 'Add app to blocklist',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            appId: z.string(),
            projectSlug: z.string(),
            reason: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Added to blocklist',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
  },
});

admin.openapi(addToBlocklistRoute, async (c) => {
  const { appId, projectSlug, reason } = c.req.valid('json');
  await blocklistService.addToBlocklist(appId, projectSlug, reason);
  return c.json({ success: true }, 201);
});

const removeFromBlocklistRoute = createRoute({
  method: 'delete',
  path: '/blocklist/{projectSlug}/{appId}',
  tags: ['Admin — Blocklist'],
  summary: 'Remove app from blocklist',
  request: {
    params: z.object({ projectSlug: z.string(), appId: z.string() }),
  },
  responses: {
    200: {
      description: 'Removed from blocklist',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    404: {
      description: 'Not found in blocklist',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

admin.openapi(removeFromBlocklistRoute, async (c) => {
  const { projectSlug, appId } = c.req.valid('param');
  const removed = await blocklistService.removeFromBlocklist(appId, projectSlug);
  if (!removed) return c.json({ error: 'Not found in blocklist' }, 404);
  return c.json({ success: true }, 200);
});

// --- Audit ---

const queryAuditRoute = createRoute({
  method: 'get',
  path: '/audit',
  tags: ['Admin — Audit'],
  summary: 'Query audit log',
  request: {
    query: z.object({
      keyId: z.string().optional(),
      project: z.string().optional(),
      method: z.string().optional(),
      result: z.enum(['allowed', 'blocked', 'error']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().int().positive().default(100).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Audit log entries',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.number(),
            timestamp: z.string(),
            keyId: z.string().nullable(),
            projectSlug: z.string().nullable(),
            method: z.string(),
            endpoint: z.string(),
            appId: z.string().nullable(),
            result: z.string(),
            reason: z.string().nullable(),
            responseStatus: z.number().nullable(),
          })),
        },
      },
    },
  },
});

admin.openapi(queryAuditRoute, async (c) => {
  const params = c.req.valid('query');
  const entries = await auditService.query(params);
  return c.json(entries, 200);
});

export { admin };
