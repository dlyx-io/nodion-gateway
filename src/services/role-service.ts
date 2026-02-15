import type { Role } from '../types.js';

interface RoutePattern {
  method: string;
  pattern: RegExp;
}

const agentAllowed: RoutePattern[] = [
  // GET
  { method: 'GET', pattern: /^\/applications(\/.*)?$/ },
  { method: 'GET', pattern: /^\/regions$/ },
  { method: 'GET', pattern: /^\/instance_types$/ },
  { method: 'GET', pattern: /^\/integrations(\/.*)?$/ },
  // POST
  { method: 'POST', pattern: /^\/applications$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/deployments$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/env_variables$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/scaling_events$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/domains$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/domains\/[^/]+\/verify$/ },
  { method: 'POST', pattern: /^\/applications\/[^/]+\/domains\/[^/]+\/connect$/ },
  // PATCH
  { method: 'PATCH', pattern: /^\/applications\/[^/]+\/env_variables\/[^/]+$/ },
  // DELETE
  { method: 'DELETE', pattern: /^\/applications\/[^/]+$/ },
  { method: 'DELETE', pattern: /^\/applications\/[^/]+\/env_variables\/[^/]+$/ },
  { method: 'DELETE', pattern: /^\/applications\/[^/]+\/domains\/[^/]+$/ },
];

const deployerAllowed: RoutePattern[] = [
  // GET
  { method: 'GET', pattern: /^\/applications(\/.*)?$/ },
  { method: 'GET', pattern: /^\/regions$/ },
  { method: 'GET', pattern: /^\/instance_types$/ },
  { method: 'GET', pattern: /^\/integrations(\/.*)?$/ },
  // POST
  { method: 'POST', pattern: /^\/applications\/[^/]+\/deployments$/ },
];

const readonlyAllowed: RoutePattern[] = [
  // GET
  { method: 'GET', pattern: /^\/applications(\/.*)?$/ },
  { method: 'GET', pattern: /^\/regions$/ },
  { method: 'GET', pattern: /^\/instance_types$/ },
  { method: 'GET', pattern: /^\/integrations(\/.*)?$/ },
];

const rolePatterns: Record<Role, RoutePattern[] | 'all'> = {
  admin: 'all',
  agent: agentAllowed,
  deployer: deployerAllowed,
  readonly: readonlyAllowed,
  custom: [], // Custom roles use scope-service instead
};

export function isAllowed(role: Role, method: string, path: string): boolean {
  const patterns = rolePatterns[role];
  if (patterns === 'all') return true;

  return patterns.some(
    (route) => route.method === method.toUpperCase() && route.pattern.test(path)
  );
}
