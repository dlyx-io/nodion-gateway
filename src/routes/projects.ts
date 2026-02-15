import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { getAccessibleProjects } from '../services/project-service.js';

const projects = new OpenAPIHono();

const listAccessibleProjectsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Projects'],
  summary: 'List projects accessible to the current key',
  responses: {
    200: {
      description: 'Accessible projects',
      content: {
        'application/json': {
          schema: z.array(z.object({ slug: z.string(), label: z.string() })),
        },
      },
    },
  },
});

projects.openapi(listAccessibleProjectsRoute, async (c) => {
  const apiKey = c.get('apiKey');
  const result = await getAccessibleProjects(apiKey.id, apiKey.role);
  return c.json(result, 200);
});

export { projects };
