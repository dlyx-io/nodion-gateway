import { serve } from '@hono/node-server';
import { config } from './config.js';
import { runMigrations, bootstrapAdminKey } from './db/migrations.js';
import { app, initializeApp } from './app.js';

async function main() {
  // Initialize database
  await runMigrations();
  await bootstrapAdminKey();

  // Initialize MCP with OpenAPI spec
  initializeApp();

  // Start server
  serve({
    fetch: app.fetch,
    port: config.PORT,
  }, (info) => {
    console.log(`Nodion Gateway running on http://localhost:${info.port}`);
    console.log(`API docs: http://localhost:${info.port}/docs`);
  });
}

main();
