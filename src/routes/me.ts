import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { getScopes } from '../services/scope-service.js';

const me = new OpenAPIHono();

const getMeRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Auth'],
  summary: 'Get current key info',
  responses: {
    200: {
      description: 'Current key details',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            label: z.string(),
            role: z.string(),
            projects: z.array(z.string()),
            scopes: z.array(z.object({
              scope: z.string(),
              target: z.string(),
              projectSlug: z.string(),
            })),
          }),
        },
      },
    },
  },
});

me.openapi(getMeRoute, async (c) => {
  const apiKey = c.get('apiKey');
  const scopes = apiKey.role === 'custom' ? await getScopes(apiKey.id) : [];

  return c.json({
    id: apiKey.id,
    label: apiKey.label,
    role: apiKey.role,
    projects: apiKey.projects,
    scopes,
  }, 200);
});

export { me };
