import { describe, it, expect } from 'vitest';
import { getRequiredScope } from '../src/services/scope-service.js';

describe('scope-service', () => {
  describe('getRequiredScope', () => {
    it('maps GET /regions and /instance_types to _public', () => {
      expect(getRequiredScope('GET', '/regions')).toEqual({ scope: '_public', appId: null });
      expect(getRequiredScope('GET', '/instance_types')).toEqual({ scope: '_public', appId: null });
    });

    it('maps POST /applications to create', () => {
      expect(getRequiredScope('POST', '/applications')).toEqual({ scope: 'create', appId: null });
    });

    it('maps DELETE /applications/:id to delete', () => {
      const result = getRequiredScope('DELETE', '/applications/abc-123');
      expect(result.scope).toBe('delete');
      expect(result.appId).toBe('abc-123');
    });

    it('maps POST /applications/:id/deployments to deploy', () => {
      const result = getRequiredScope('POST', '/applications/abc-123/deployments');
      expect(result.scope).toBe('deploy');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET /applications/:id/env_variables to env:read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123/env_variables');
      expect(result.scope).toBe('env:read');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET /applications/:id/env_variables/:id to env:read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123/env_variables/var-456');
      expect(result.scope).toBe('env:read');
      expect(result.appId).toBe('abc-123');
    });

    it('maps POST /applications/:id/env_variables to env:write', () => {
      const result = getRequiredScope('POST', '/applications/abc-123/env_variables');
      expect(result.scope).toBe('env:write');
      expect(result.appId).toBe('abc-123');
    });

    it('maps PATCH /applications/:id/env_variables/:id to env:write', () => {
      const result = getRequiredScope('PATCH', '/applications/abc-123/env_variables/var-456');
      expect(result.scope).toBe('env:write');
      expect(result.appId).toBe('abc-123');
    });

    it('maps DELETE /applications/:id/env_variables/:id to env:write', () => {
      const result = getRequiredScope('DELETE', '/applications/abc-123/env_variables/var-456');
      expect(result.scope).toBe('env:write');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET/POST /applications/:id/scaling_events to scale', () => {
      expect(getRequiredScope('GET', '/applications/abc-123/scaling_events').scope).toBe('scale');
      expect(getRequiredScope('POST', '/applications/abc-123/scaling_events').scope).toBe('scale');
    });

    it('maps GET /applications to read (list)', () => {
      expect(getRequiredScope('GET', '/applications')).toEqual({ scope: 'read', appId: null });
    });

    it('maps GET /applications/:id to read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123');
      expect(result.scope).toBe('read');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET /applications/:id/deployments to read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123/deployments');
      expect(result.scope).toBe('read');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET /applications/:id/instances to read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123/instances');
      expect(result.scope).toBe('read');
      expect(result.appId).toBe('abc-123');
    });

    it('maps GET /applications/:id/metrics to read', () => {
      const result = getRequiredScope('GET', '/applications/abc-123/metrics');
      expect(result.scope).toBe('read');
      expect(result.appId).toBe('abc-123');
    });
  });

  describe('custom role blocks via role-service', () => {
    // Import after scope tests to avoid DB initialization
    it('custom role has no role-based permissions', async () => {
      const { isAllowed } = await import('../src/services/role-service.js');
      expect(isAllowed('custom', 'GET', '/applications')).toBe(false);
      expect(isAllowed('custom', 'POST', '/applications')).toBe(false);
    });
  });
});
