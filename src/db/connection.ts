import { config } from '../config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawSqliteDb: any = null;

if (config.DB_DIALECT === 'pg') {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: config.DATABASE_URL });
  const schema = await import('./schema/postgres.js');
  db = drizzle(pool, { schema });
} else {
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const Database = (await import('better-sqlite3')).default;
  const { mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(config.DB_PATH), { recursive: true });
  const sqlite = new Database(config.DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  rawSqliteDb = sqlite;
  const schema = await import('./schema/sqlite.js');
  db = drizzle(sqlite, { schema });
}

export { db, rawSqliteDb };
