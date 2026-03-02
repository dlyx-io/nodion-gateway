export type Role = 'admin' | 'agent' | 'deployer' | 'readonly' | 'custom';

export type Scope = 'read' | 'env:read' | 'env:write' | 'deploy' | 'scale' | 'create' | 'delete' | 'domain:write' | 'manage';

export interface KeyScope {
  scope: Scope;
  target: string; // app ID, 'owned', or '*'
}

export interface Project {
  slug: string;
  label: string;
  nodionApiKeyEncrypted: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  keyHash: string;
  label: string;
  role: Role;
  projects: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface Resource {
  appId: string;
  projectSlug: string;
  createdByKey: string;
  createdAt: string;
  label: string | null;
  lastDeployedAt: string | null;
}

export interface BlocklistEntry {
  appId: string;
  projectSlug: string;
  reason: string;
  createdAt: string;
}

export interface ServiceAccount {
  id: string;
  label: string;
  email: string;
  passwordEncrypted: string;
  totpSecretEncrypted: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  keyId: string | null;
  projectSlug: string | null;
  method: string;
  endpoint: string;
  appId: string | null;
  result: 'allowed' | 'blocked' | 'error';
  reason: string | null;
  responseStatus: number | null;
}
