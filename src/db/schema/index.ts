import { config } from '../../config.js';
import * as sqliteSchema from './sqlite.js';
import * as pgSchema from './postgres.js';

// Both schemas have identical structure, so we cast to the SQLite type for a unified API
export const schema = (config.DB_DIALECT === 'pg' ? pgSchema : sqliteSchema) as typeof sqliteSchema;

export const {
  projects,
  apiKeys,
  apiKeyProjects,
  resources,
  blocklist,
  keyScopes,
  serviceAccounts,
  auditLog,
} = schema;
