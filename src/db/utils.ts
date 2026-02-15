import { config } from '../config.js';
import { db, rawSqliteDb } from './connection.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasChanges(result: any): boolean {
  return (result.changes ?? result.rowCount ?? 0) > 0;
}

/**
 * Runs a function inside a database transaction.
 *
 * For PG: uses Drizzle's native async transaction with a proper tx object.
 * For SQLite: uses manual BEGIN/COMMIT on the raw connection. The async callback
 * receives `db` as the tx (same connection, same transaction scope). Since all
 * SQLite operations are synchronous, `await` on them resolves immediately,
 * keeping everything within the BEGIN/COMMIT boundaries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runTransaction(fn: (tx: any) => Promise<void>): Promise<void> {
  if (config.DB_DIALECT === 'pg') {
    await db.transaction(fn);
  } else {
    rawSqliteDb.exec('BEGIN');
    try {
      await fn(db);
      rawSqliteDb.exec('COMMIT');
    } catch (e) {
      rawSqliteDb.exec('ROLLBACK');
      throw e;
    }
  }
}
