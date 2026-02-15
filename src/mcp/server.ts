import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import { Hono } from 'hono';

interface OpenAPIEndpoint {
  operationId: string;
  method: string;
  path: string;
  summary: string;
  tags: string[];
}

interface OpenAPISpec {
  paths: Record<string, Record<string, {
    operationId?: string;
    summary?: string;
    tags?: string[];
    parameters?: unknown[];
    requestBody?: unknown;
    responses?: unknown;
  }>>;
}

let cachedSpec: OpenAPISpec | null = null;
let cachedEndpoints: OpenAPIEndpoint[] = [];

function loadSpec(spec: OpenAPISpec): void {
  cachedSpec = spec;
  cachedEndpoints = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (details.operationId) {
        cachedEndpoints.push({
          operationId: details.operationId,
          method: method.toUpperCase(),
          path,
          summary: details.summary || '',
          tags: details.tags || [],
        });
      }
    }
  }
}

function createMcpServer(authHeader: string): McpServer {
  const server = new McpServer({
    name: 'nodion-gateway',
    version: '1.0.0',
  });

  server.tool(
    'list_endpoints',
    'List all available API endpoints. Optionally filter by tag or search text.',
    {
      tag: z.string().optional().describe('Filter by tag name'),
      search: z.string().optional().describe('Search in endpoint path or summary'),
    },
    async ({ tag, search }) => {
      let endpoints = cachedEndpoints;

      if (tag) {
        endpoints = endpoints.filter((e) => e.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())));
      }
      if (search) {
        const s = search.toLowerCase();
        endpoints = endpoints.filter(
          (e) => e.path.toLowerCase().includes(s) || e.summary.toLowerCase().includes(s)
        );
      }

      const text = endpoints
        .map((e) => `${e.method} ${e.path} — ${e.summary} [${e.operationId}]`)
        .join('\n');

      return { content: [{ type: 'text' as const, text: text || 'No endpoints found.' }] };
    }
  );

  server.tool(
    'get_endpoint_schema',
    'Get the full OpenAPI schema for an endpoint by operationId.',
    {
      operationId: z.string().describe('The operationId of the endpoint'),
    },
    async ({ operationId }) => {
      if (!cachedSpec) {
        return { content: [{ type: 'text' as const, text: 'OpenAPI spec not loaded.' }] };
      }

      for (const [path, methods] of Object.entries(cachedSpec.paths)) {
        for (const [method, details] of Object.entries(methods)) {
          if (details.operationId === operationId) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({ method: method.toUpperCase(), path, ...details }, null, 2),
              }],
            };
          }
        }
      }

      return { content: [{ type: 'text' as const, text: `Endpoint '${operationId}' not found.` }] };
    }
  );

  server.tool(
    'call_endpoint',
    'Execute an API call to the gateway. The call uses the same auth as the MCP session.',
    {
      operationId: z.string().describe('The operationId of the endpoint to call'),
      pathParams: z.record(z.string()).optional().describe('Path parameters (e.g. { "slug": "my-project" })'),
      queryParams: z.record(z.string()).optional().describe('Query parameters'),
      body: z.any().optional().describe('JSON request body'),
    },
    async ({ operationId, pathParams, queryParams, body }) => {
      const endpoint = cachedEndpoints.find((e) => e.operationId === operationId);
      if (!endpoint) {
        return { content: [{ type: 'text' as const, text: `Endpoint '${operationId}' not found.` }] };
      }

      let path = endpoint.path;
      if (pathParams) {
        for (const [key, value] of Object.entries(pathParams)) {
          path = path.replace(`{${key}}`, value);
        }
      }

      if (queryParams) {
        const qs = new URLSearchParams(queryParams).toString();
        path += `?${qs}`;
      }

      try {
        const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
        const res = await fetch(`${baseUrl}${path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const responseText = await res.text();
        return {
          content: [{
            type: 'text' as const,
            text: `Status: ${res.status}\n\n${responseText}`,
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }] };
      }
    }
  );

  return server;
}

// Session management: map session IDs to connected MCP client/server pairs
interface McpSession {
  server: McpServer;
  client: Client;
  clientTransport: InstanceType<typeof InMemoryTransport>;
  serverTransport: InstanceType<typeof InMemoryTransport>;
}

const sessions = new Map<string, McpSession>();

async function getOrCreateSession(sessionId: string, authHeader: string): Promise<McpSession> {
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const server = createMcpServer(authHeader);
  const client = new Client({ name: 'mcp-http-bridge', version: '1.0.0' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const session: McpSession = { server, client, clientTransport, serverTransport };
  sessions.set(sessionId, session);
  return session;
}

export function initMcp(openApiSpec: OpenAPISpec): void {
  loadSpec(openApiSpec);
}

export const mcpRouter = new Hono();

mcpRouter.get('/health', (c) => c.json({ status: 'ok', type: 'mcp' }));

// Streamable HTTP: handle JSON-RPC over POST
mcpRouter.post('/', async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  let sessionId = c.req.header('mcp-session-id');

  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  const session = await getOrCreateSession(sessionId, authHeader);
  const jsonRpcRequest = await c.req.json();

  // Send the JSON-RPC request through the client transport and collect response
  // We use the client's internal transport to forward
  const response = await handleJsonRpc(session, jsonRpcRequest);

  return c.json(response, 200, {
    'mcp-session-id': sessionId,
  });
});

async function handleJsonRpc(session: McpSession, request: unknown): Promise<unknown> {
  const { client } = session;

  // Handle based on JSON-RPC method
  const req = request as { method: string; params?: unknown; id?: number | string };

  if (req.method === 'initialize') {
    // Return server capabilities
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'nodion-gateway', version: '1.0.0' },
      },
    };
  }

  if (req.method === 'notifications/initialized') {
    return { jsonrpc: '2.0', id: req.id, result: {} };
  }

  if (req.method === 'tools/list') {
    const tools = await client.listTools();
    return { jsonrpc: '2.0', id: req.id, result: tools };
  }

  if (req.method === 'tools/call') {
    const params = req.params as { name: string; arguments?: Record<string, unknown> };
    const result = await client.callTool({ name: params.name, arguments: params.arguments || {} });
    return { jsonrpc: '2.0', id: req.id, result };
  }

  return {
    jsonrpc: '2.0',
    id: req.id,
    error: { code: -32601, message: `Method not found: ${req.method}` },
  };
}

mcpRouter.delete('/', async (c) => {
  const sessionId = c.req.header('mcp-session-id');
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.clientTransport.close();
    await session.serverTransport.close();
    sessions.delete(sessionId);
  }
  return c.json({ success: true });
});
