import { describe, it, expect } from 'vitest';
import { isAllowed } from '../src/services/role-service.js';

describe('role-service', () => {
  describe('admin', () => {
    it('allows everything', () => {
      expect(isAllowed('admin', 'GET', '/applications')).toBe(true);
      expect(isAllowed('admin', 'DELETE', '/applications/123')).toBe(true);
      expect(isAllowed('admin', 'POST', '/dns_zones')).toBe(true);
    });
  });

  describe('agent', () => {
    it('allows GET on applications', () => {
      expect(isAllowed('agent', 'GET', '/applications')).toBe(true);
      expect(isAllowed('agent', 'GET', '/applications/123')).toBe(true);
      expect(isAllowed('agent', 'GET', '/applications/123/deployments')).toBe(true);
      expect(isAllowed('agent', 'GET', '/applications/123/env_variables')).toBe(true);
    });

    it('allows GET on regions and instance_types', () => {
      expect(isAllowed('agent', 'GET', '/regions')).toBe(true);
      expect(isAllowed('agent', 'GET', '/instance_types')).toBe(true);
    });

    it('allows POST on applications, deployments, env_variables, scaling_events', () => {
      expect(isAllowed('agent', 'POST', '/applications')).toBe(true);
      expect(isAllowed('agent', 'POST', '/applications/123/deployments')).toBe(true);
      expect(isAllowed('agent', 'POST', '/applications/123/env_variables')).toBe(true);
      expect(isAllowed('agent', 'POST', '/applications/123/scaling_events')).toBe(true);
    });

    it('allows PATCH on env_variables', () => {
      expect(isAllowed('agent', 'PATCH', '/applications/123/env_variables/456')).toBe(true);
    });

    it('allows DELETE on applications and env_variables', () => {
      expect(isAllowed('agent', 'DELETE', '/applications/123')).toBe(true);
      expect(isAllowed('agent', 'DELETE', '/applications/123/env_variables/456')).toBe(true);
    });

    it('blocks DNS and email zones', () => {
      expect(isAllowed('agent', 'GET', '/dns_zones')).toBe(false);
      expect(isAllowed('agent', 'POST', '/dns_zones')).toBe(false);
      expect(isAllowed('agent', 'GET', '/email_zones')).toBe(false);
    });
  });

  describe('deployer', () => {
    it('allows GET on applications, regions, instance_types', () => {
      expect(isAllowed('deployer', 'GET', '/applications')).toBe(true);
      expect(isAllowed('deployer', 'GET', '/applications/123')).toBe(true);
      expect(isAllowed('deployer', 'GET', '/regions')).toBe(true);
      expect(isAllowed('deployer', 'GET', '/instance_types')).toBe(true);
    });

    it('allows POST on deployments only', () => {
      expect(isAllowed('deployer', 'POST', '/applications/123/deployments')).toBe(true);
    });

    it('blocks POST on applications', () => {
      expect(isAllowed('deployer', 'POST', '/applications')).toBe(false);
    });

    it('blocks DELETE and PATCH', () => {
      expect(isAllowed('deployer', 'DELETE', '/applications/123')).toBe(false);
      expect(isAllowed('deployer', 'PATCH', '/applications/123/env_variables/456')).toBe(false);
    });
  });

  describe('readonly', () => {
    it('allows GET on applications, regions, instance_types', () => {
      expect(isAllowed('readonly', 'GET', '/applications')).toBe(true);
      expect(isAllowed('readonly', 'GET', '/applications/123/env_variables')).toBe(true);
      expect(isAllowed('readonly', 'GET', '/regions')).toBe(true);
    });

    it('blocks all mutations', () => {
      expect(isAllowed('readonly', 'POST', '/applications')).toBe(false);
      expect(isAllowed('readonly', 'POST', '/applications/123/deployments')).toBe(false);
      expect(isAllowed('readonly', 'DELETE', '/applications/123')).toBe(false);
      expect(isAllowed('readonly', 'PATCH', '/applications/123/env_variables/456')).toBe(false);
    });
  });
});
