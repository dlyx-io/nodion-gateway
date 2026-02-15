import type { Context, Next } from 'hono';
import { getProject } from '../services/project-service.js';
import { hasProjectAccess } from '../services/key-service.js';
import type { Project } from '../types.js';

declare module 'hono' {
  interface ContextVariableMap {
    project: Project;
    nodionPath: string;
  }
}

export async function projectMiddleware(c: Context, next: Next): Promise<Response | void> {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ error: 'Project slug is required' }, 400);
  }

  const project = await getProject(slug);
  if (!project) {
    return c.json({ error: `Project '${slug}' not found` }, 404);
  }

  const apiKey = c.get('apiKey');
  if (!(await hasProjectAccess(apiKey.id, slug, apiKey.role))) {
    return c.json({ error: `No access to project '${slug}'` }, 403);
  }

  // Derive the Nodion path by stripping everything up to and including /projects/:slug
  // Include query string so pagination/filter params are forwarded to Nodion
  const fullPath = c.req.path;
  const marker = `/projects/${slug}`;
  const markerIdx = fullPath.indexOf(marker);
  const pathOnly = markerIdx >= 0
    ? (fullPath.slice(markerIdx + marker.length) || '/')
    : '/';
  const url = new URL(c.req.url);
  const nodionPath = url.search ? `${pathOnly}${url.search}` : pathOnly;

  c.set('project', project);
  c.set('nodionPath', nodionPath);
  await next();
}
