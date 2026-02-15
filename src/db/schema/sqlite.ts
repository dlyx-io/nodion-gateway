import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  slug: text('slug').primaryKey(),
  label: text('label').notNull(),
  nodionApiKeyEncrypted: text('nodion_api_key_encrypted').notNull(),
  createdAt: text('created_at').notNull(),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  label: text('label').notNull(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at'),
  revokedAt: text('revoked_at'),
});

export const apiKeyProjects = sqliteTable('api_key_projects', {
  keyId: text('key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  projectSlug: text('project_slug').notNull().references(() => projects.slug, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.keyId, table.projectSlug] }),
]);

export const resources = sqliteTable('resources', {
  appId: text('app_id').notNull(),
  projectSlug: text('project_slug').notNull().references(() => projects.slug),
  createdByKey: text('created_by_key').notNull().references(() => apiKeys.id),
  createdAt: text('created_at').notNull(),
  label: text('label'),
  lastDeployedAt: text('last_deployed_at'),
}, (table) => [
  primaryKey({ columns: [table.appId, table.projectSlug] }),
]);

export const blocklist = sqliteTable('blocklist', {
  appId: text('app_id').notNull(),
  projectSlug: text('project_slug').notNull().references(() => projects.slug),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.appId, table.projectSlug] }),
]);

export const keyScopes = sqliteTable('key_scopes', {
  keyId: text('key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  projectSlug: text('project_slug').notNull().references(() => projects.slug, { onDelete: 'cascade' }),
  scope: text('scope').notNull(),
  target: text('target').notNull().default('*'),
}, (table) => [
  primaryKey({ columns: [table.keyId, table.projectSlug, table.scope, table.target] }),
]);

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  keyId: text('key_id'),
  projectSlug: text('project_slug'),
  method: text('method').notNull(),
  endpoint: text('endpoint').notNull(),
  appId: text('app_id'),
  result: text('result').notNull(),
  reason: text('reason'),
  responseStatus: integer('response_status'),
});
