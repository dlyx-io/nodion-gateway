import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { serveStatic } from '@hono/node-server/serve-static';
import { authMiddleware } from './middleware/auth.js';
import { admin } from './routes/admin.js';
import { projects } from './routes/projects.js';
import { proxy } from './routes/proxy.js';
import { me } from './routes/me.js';
import { integrations } from './routes/integrations.js';
import { mcpRouter, initMcp } from './mcp/server.js';

const app = new OpenAPIHono();

// Health check on root (no prefix, Nodion requirement)
app.get('/health', (c) => c.json({ status: 'ok' }));

// --- API sub-app under /api ---
const api = new OpenAPIHono();

// OpenAPI security scheme
api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'Gateway API key (use your ADMIN_BOOTSTRAP_KEY or a key from POST /api/admin/keys)',
});

// OpenAPI spec
api.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Nodion Gateway',
    version: '1.0.0',
    description: 'RBAC proxy for the Nodion PaaS API — issue scoped API keys with fine-grained permissions',
  },
  servers: [{ url: '/api', description: 'API' }],
  security: [{ bearerAuth: [] }],
});

// Swagger UI
api.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

// MCP endpoint
api.route('/mcp', mcpRouter);

// Auth required
api.use('/me', authMiddleware);
api.use('/admin/*', authMiddleware);
api.use('/projects/*', authMiddleware);
api.use('/integrations', authMiddleware);
api.use('/integrations/*', authMiddleware);

// Routes
api.route('/me', me);
api.route('/admin', admin);
api.route('/projects', projects);
api.route('/integrations', integrations);
api.route('/', proxy);

// Mount API
app.route('/api', api);

// --- Frontend static files ---
app.use('/*', serveStatic({ root: './frontend/dist' }));
app.get('/*', serveStatic({ root: './frontend/dist', path: 'index.html' }));

// Initialize MCP with OpenAPI spec
export function initializeApp(): void {
  const spec = api.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Nodion Gateway',
      version: '1.0.0',
      description: 'RBAC proxy for the Nodion PaaS API',
    },
  });
  initMcp(spec as any);
}

export { app };
