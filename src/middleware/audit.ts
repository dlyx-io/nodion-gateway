import type { Context, Next } from 'hono';
import * as auditService from '../services/audit-service.js';

export async function auditMiddleware(c: Context, next: Next): Promise<void> {
  await next();

  try {
    const apiKey = c.get('apiKey');
    const project = c.get('project');
    const nodionPath: string | undefined = c.get('nodionPath');

    // Extract app ID from path
    const appIdMatch = nodionPath?.match(/\/applications\/([a-f0-9-]+)/);
    const appId = appIdMatch ? appIdMatch[1] : null;

    const status = c.res.status;
    let result: 'allowed' | 'blocked' | 'error';
    if (status >= 200 && status < 400) {
      result = 'allowed';
    } else if (status === 403) {
      result = 'blocked';
    } else {
      result = 'error';
    }

    await auditService.log({
      keyId: apiKey?.id ?? null,
      projectSlug: project?.slug ?? null,
      method: c.req.method,
      endpoint: nodionPath ?? c.req.path,
      appId,
      result,
      responseStatus: status,
    });
  } catch {
    // Audit logging should never break the request
  }
}
