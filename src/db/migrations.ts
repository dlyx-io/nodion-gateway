import { createHash } from 'node:crypto';
import { db } from './connection.js';
import { config } from '../config.js';
import { apiKeys } from './schema/index.js';
import { count } from 'drizzle-orm';

export async function runMigrations(): Promise<void> {
  if (config.DB_DIALECT === 'pg') {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder: './drizzle/pg' });
  } else {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    migrate(db, { migrationsFolder: './drizzle/sqlite' });
  }
}

export async function bootstrapAdminKey(): Promise<void> {
  const result = await db.select({ value: count() }).from(apiKeys);
  if (result[0].value > 0) return;

  const keyHash = createHash('sha256').update(config.ADMIN_BOOTSTRAP_KEY).digest('hex');

  await db.insert(apiKeys).values({
    id: 'bootstrap-admin',
    keyHash,
    label: 'Bootstrap Admin',
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  console.log('Bootstrap admin key registered.');
}
