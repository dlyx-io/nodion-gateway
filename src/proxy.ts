import { config } from './config.js';

export async function forwardToNodion(
  nodionApiKey: string,
  path: string,
  method: string,
  body?: string | null,
): Promise<Response> {
  const url = `${config.NODION_API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${nodionApiKey}`,
    'Accept': 'application/json',
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body && (method === 'POST' || method === 'PATCH' || method === 'PUT') ? body : undefined,
  });

  return response;
}
