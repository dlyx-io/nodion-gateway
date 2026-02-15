import type { Context, Next } from 'hono';
import { validateKey } from '../services/key-service.js';
import type { ApiKey } from '../types.js';

declare module 'hono' {
  interface ContextVariableMap {
    apiKey: ApiKey;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const apiKey = await validateKey(token);

  if (!apiKey) {
    return c.json({ error: 'Invalid, expired, or revoked API key' }, 401);
  }

  c.set('apiKey', apiKey);
  await next();
}

export async function adminOnly(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.get('apiKey');
  if (apiKey.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
}
