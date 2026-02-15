import { getToken } from './auth.js';

const BASE = '/api';

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  return res;
}

export async function get<T = unknown>(path: string): Promise<T> {
  const res = await request(path);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function patch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function del<T = unknown>(path: string): Promise<T> {
  const res = await request(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function put<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Fetches a resource from all projects in parallel and merges results by ID.
 * Used for integrations, repositories, and branches which may differ per project API key.
 */
export async function fetchMerged<T extends { id: string }>(
  projects: string[],
  pathFn: (slug: string) => string,
  dataKey: string,
): Promise<T[]> {
  const results = await Promise.allSettled(
    projects.map(async (slug) => {
      const r = await get<any>(pathFn(slug));
      return (r[dataKey] || r.data || []) as T[];
    }),
  );

  const seen = new Map<string, T>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (!seen.has(item.id)) {
          seen.set(item.id, item);
        }
      }
    }
  }
  return Array.from(seen.values());
}
