# CLAUDE.md — Nodion Gateway

## Project Overview

Nodion Gateway is a standalone RBAC (Role-Based Access Control) proxy for the [Nodion](https://www.nodion.com/) PaaS API. Nodion API keys have **no scopes or roles** — a single key can do everything: create/delete apps, change DNS, scale instances. This gateway sits between clients and the Nodion API, issuing its own scoped API keys with fine-grained permissions.

The project is **generic** (not tied to any specific Nodion customer) and licensed under MIT.

**Repository**: https://github.com/dlyx-io/nodion-gateway
**Production URL**: https://nodion-api-gateway-web.euc.nodion.app/

## Architecture

```
Client (Agent, CI, Script)  ──→  Nodion Gateway  ──→  Nodion API
(Gateway API key with scopes)    (validates,         (real Nodion key,
                                  filters,            stored per project
                                  tracks,             in gateway DB)
                                  audits)
```

### Multi-Project Design

Nodion organizes apps into **projects**, each with its own API key. The gateway manages multiple projects centrally. All proxy requests use a **project prefix**:

```
GET  /projects/control-center/applications
POST /projects/directus/applications/:id/deployments
GET  /projects/control-center/applications/:id/env_variables
```

The gateway:
1. Extracts the project slug from the path
2. Looks up the corresponding Nodion API key
3. Strips the prefix and forwards to `https://api.nodion.com/v1/...`

This is always consistent — whether 1 or 10 projects are configured. Adding a new project doesn't change existing API calls.

## Nodion API Reference

**Base URL**: `https://api.nodion.com/v1/`
**Auth**: `Authorization: Bearer <NODION_API_KEY>`
**Docs**: https://www.nodion.com/en/docs/api/

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /applications | List all applications |
| GET | /applications/:id | Get application details (includes `status` attribute) |
| POST | /applications | Create application (requires: name, region_id, instance_type_id, instance_amount, integration_id, repository_id, branch_id) |
| DELETE | /applications/:id | Delete application |
| GET | /applications/:id/deployments | List deployments (status: `created`, `waiting`, `available`, `failed`, `expired`) |
| POST | /applications/:id/deployments | Trigger deployment (also works as restart — reuses existing image, no rebuild) |
| GET | /applications/:id/env_variables | List environment variables |
| GET | /applications/:id/env_variables/:id | Get single env variable |
| POST | /applications/:id/env_variables | Create env variable (body: `env_key`, `env_val`, optional `buildtime`) |
| PATCH | /applications/:id/env_variables/:id | Update env variable |
| DELETE | /applications/:id/env_variables/:id | Delete env variable |
| GET | /applications/:id/instances | Instance status |
| GET | /applications/:id/metrics | CPU/RAM metrics |
| GET/POST | /applications/:id/scaling_events | Scaling events |
| GET | /regions | Available regions |
| GET | /instance_types | Available instance types |
| GET | /integrations | List Git integrations (undocumented) |
| GET | /integrations/:id/repositories | List repos for integration (undocumented) |
| GET | /integrations/:id/repositories/:repoId/branches | List branches for repo (undocumented) |
| GET | /applications/:id/domains | List domains |
| POST | /applications/:id/domains | Add domain (body: `domain_name`) |
| POST | /applications/:id/domains/:id/verify | Verify domain (TXT DNS record) |
| POST | /applications/:id/domains/:id/connect | Connect domain (CNAME/ALIAS, requires redeploy) |
| DELETE | /applications/:id/domains/:id | Remove domain |
| GET/POST/DELETE | /dns_zones/* | DNS zone management |
| GET | /email_zones/* | Email zone management |

**IMPORTANT**: Environment variables endpoint is `/env_variables` (NOT `/environment_variables`).

### Deployment Status Lifecycle

`created` → `waiting` → `available` | `failed` | `expired`

The last deployment with status `available` is live.

### Restart Workaround

No explicit restart endpoint. Trigger a new deployment (`POST /applications/:id/deployments`) — Nodion reuses the existing image without rebuilding. Env vars are refreshed (except build-time vars).

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript (ESM)
- **HTTP Framework**: Hono with `@hono/zod-openapi` (type-safe routes with automatic OpenAPI spec)
- **API Documentation**: `@hono/swagger-ui` (Swagger UI at `/docs`)
- **ORM**: Drizzle ORM (type-safe, dual-dialect: SQLite for local dev, PostgreSQL for production)
- **Database (local dev)**: better-sqlite3 via `drizzle-orm/better-sqlite3`
- **Database (production)**: PostgreSQL via `drizzle-orm/node-postgres` (Nodion Managed Database)
- **Validation**: zod via `@hono/zod-openapi`
- **Tests**: vitest
- **Build**: tsup (esbuild-based)
- **MCP**: `@modelcontextprotocol/sdk` (AI tool integration)

## Key Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
```

## Project Structure

```
nodion-gateway/
├── src/
│   ├── index.ts              # Entry point, server start
│   ├── app.ts                # Hono app setup (OpenAPIHono), middleware chain
│   ├── proxy.ts              # Request forwarding to Nodion API
│   ├── middleware/
│   │   ├── auth.ts           # API key validation from Authorization header
│   │   ├── project.ts        # Extract project slug, look up Nodion key
│   │   └── audit.ts          # Request logging middleware
│   ├── routes/
│   │   ├── admin.ts          # Admin endpoints (keys, projects, service-accounts, blocklist, audit)
│   │   ├── integrations.ts   # Aggregated integrations from projects + service accounts
│   │   ├── projects.ts       # GET /projects — list accessible projects per key
│   │   └── proxy.ts          # Proxy route under /projects/:slug/*
│   ├── services/
│   │   ├── key-service.ts    # API key creation, validation, revocation
│   │   ├── project-service.ts    # Project CRUD, key lookup by slug
│   │   ├── role-service.ts   # Role definitions, scope checking
│   │   ├── ownership-service.ts  # Resource ownership tracking
│   │   ├── blocklist-service.ts  # Production app blocklist
│   │   ├── audit-service.ts     # Audit log queries
│   │   ├── service-account-service.ts  # Service account CRUD
│   │   └── nodion-session.ts    # /ui/v1/ session management (token rotation, TOTP)
│   ├── db/
│   │   ├── schema.ts         # Drizzle table definitions (7 tables)
│   │   ├── connection.ts     # DB connection (SQLite or PostgreSQL based on env)
│   │   └── migrate.ts        # Auto-migration on startup
│   ├── mcp/
│   │   └── server.ts         # MCP server (3 meta-tools against OpenAPI spec)
│   ├── config.ts             # Environment variables with zod validation
│   └── types.ts              # Types (Role, ApiKey, Project, Resource, ServiceAccount, AuditEntry)
├── tests/
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Database

### Dual-Dialect Setup (Drizzle ORM)

- **Local dev**: SQLite via `better-sqlite3` — zero setup, just `npm run dev`
- **Production**: PostgreSQL via `node-postgres` — Nodion Managed Database

The `DATABASE_URL` env var controls which dialect is used:
- If set (e.g., `postgresql://...`): PostgreSQL mode
- If not set: SQLite mode (file at `DB_PATH`, default `./data/gateway.db`)

Schema is defined once in `src/db/schema.ts` using Drizzle's dialect-agnostic API. Connection setup in `src/db/connection.ts` picks the right driver at runtime.

### Tables (7)

- **projects** — Nodion projects with encrypted API keys (slug, label, nodion_api_key_encrypted)
- **api_keys** — Gateway API keys with SHA-256 hashes (id, key_hash, label, role)
- **api_key_projects** — M2M: which projects a key can access
- **resources** — Ownership tracking: which key created which app (app_id, project_slug, created_by_key)
- **blocklist** — Production app protection (app_id, project_slug, reason)
- **service_accounts** — Nodion user credentials for /ui/v1/ session access (id, label, email, password_encrypted, totp_secret_encrypted)
- **audit_log** — Every request logged (timestamp, key_id, project_slug, method, endpoint, result)

## Roles & Scopes

| Role | GET | POST | PATCH | DELETE |
|------|-----|------|-------|--------|
| admin | everything | everything | everything | everything |
| agent | /applications/\*, /regions, /instance_types, /integrations/\* | /applications, deployments, env_variables, scaling_events, domains, domains/verify, domains/connect | env_variables | /applications/:id, env_variables, domains |
| deployer | /applications/\*, /regions, /instance_types, /integrations/\* | deployments only | — | — |
| readonly | /applications/\*, /regions, /instance_types, /integrations/\* | — | — | — |

All non-admin roles blocked from: /dns_zones/\*, /email_zones/\*

These paths are **Nodion paths after stripping the project prefix**. Role checks operate on the Nodion path, not the gateway path.

## API Reference

### Public Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /projects | List projects accessible to current key | Any key |
| GET | /integrations | Aggregated integrations (projects + service accounts) | Any key |
| GET | /integrations/:id/repositories | List repos for integration | Any key |
| GET | /integrations/:id/repositories/:repoId/branches | List branches | Any key |
| POST | /integrations/:id/sync_repos | Sync repo list (service-account only) | Any key |
| POST | /integrations/:id/sync_repo | Sync branches (service-account only) | Any key |
| GET | /docs | Swagger UI | None |
| GET | /openapi.json | OpenAPI 3.1 spec | None |
| GET | /health | Health check | None |
| POST | /mcp | MCP endpoint (Streamable HTTP) | Any key |
| GET | /mcp/health | MCP health check | None |

### Admin Endpoints (admin role only)

| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/projects | Create project (slug, label, nodionApiKey) |
| GET | /admin/projects | List all projects (without keys) |
| GET | /admin/projects/:slug | Get project detail |
| PATCH | /admin/projects/:slug | Update project |
| DELETE | /admin/projects/:slug | Delete project |
| POST | /admin/keys | Create API key (label, role, projects?, expiresAt?) |
| GET | /admin/keys | List all keys (without hashes) |
| DELETE | /admin/keys/:id | Revoke key |
| GET | /admin/resources | List tracked resources (?project=slug) |
| POST | /admin/blocklist | Add to blocklist (appId, projectSlug, reason) |
| DELETE | /admin/blocklist/:projectSlug/:appId | Remove from blocklist |
| GET | /admin/audit | Query audit log (filters: keyId, project, method, result, from, to, limit) |
| POST | /admin/service-accounts | Create service account (label, email, password, totpSecret?) |
| GET | /admin/service-accounts | List service accounts (no credentials) |
| PATCH | /admin/service-accounts/:id | Update service account |
| DELETE | /admin/service-accounts/:id | Delete service account |

### Proxy Endpoints

All Nodion API endpoints are accessible under `/projects/:slug/...`. The gateway validates permissions and forwards:

```
GET    /projects/:slug/applications                    → GET /applications
POST   /projects/:slug/applications                    → POST /applications
DELETE /projects/:slug/applications/:id                → DELETE /applications/:id
POST   /projects/:slug/applications/:id/deployments    → POST /applications/:id/deployments
GET    /projects/:slug/applications/:id/env_variables  → GET /applications/:id/env_variables
...etc
```

### Proxy Request Flow

1. Auth middleware: validate gateway API key
2. Project middleware: extract slug, load project, check key access
3. Derive Nodion path (strip `/projects/:slug` prefix)
4. Role check: `isAllowed(role, method, nodionPath)`
5. Blocklist check: is the app ID blocked?
6. Ownership check (for mutating requests): does the key own this resource?
7. Forward to Nodion API with the project's real API key
8. Track new resources (on POST /applications)
9. Remove tracked resources (on DELETE /applications/:id)
10. Write audit log
11. Return Nodion response to client

## Configuration

```env
# .env
NODION_API_BASE_URL=https://api.nodion.com/v1   # Nodion API base URL
PORT=3000                                        # Gateway port
ADMIN_BOOTSTRAP_KEY=<secret>                     # Initial admin key (registered on first start)

# Database — set ONE of these:
DATABASE_URL=postgresql://user:pass@host:5432/nodion_gateway  # Production (PostgreSQL)
DB_PATH=./data/gateway.db                        # Local dev (SQLite, default if DATABASE_URL not set)
```

Nodion API keys are stored **per project in the database** (not as env vars). Managed via `POST /admin/projects`.

Service account credentials (for `/ui/v1/` access) are also stored in the database. Managed via `POST /admin/service-accounts`. These are **optional** — the gateway works without any service account configured.

## Docker

```bash
docker build -t nodion-gateway .

# Production (PostgreSQL)
docker run -d --name nodion-gateway -p 3000:3000 \
  -e ADMIN_BOOTSTRAP_KEY=my-secret-admin-key \
  -e DATABASE_URL=postgresql://user:pass@host:5432/nodion_gateway \
  nodion-gateway

# Local dev (SQLite)
docker run -d --name nodion-gateway -p 3000:3000 \
  -e ADMIN_BOOTSTRAP_KEY=my-secret-admin-key \
  -v gateway-data:/data \
  nodion-gateway
```

## MCP Integration

The gateway exposes an MCP endpoint for AI tools (Claude Code, Claude Desktop):

```bash
claude mcp add nodion-gateway \
  --transport http \
  --url https://gateway.example.com/mcp \
  --header "Authorization: Bearer <gateway-api-key>"
```

3 meta-tools: `list_endpoints`, `get_endpoint_schema`, `call_endpoint`

## Security

- Real Nodion API keys stored only in gateway DB (encrypted)
- Gateway API keys stored as SHA-256 hashes
- Blocklist protects production resources from accidental deletion
- Ownership prevents key A from deleting key B's apps
- Audit log tracks every request
- HTTPS required in production

## Important Patterns

- Use `@hono/zod-openapi` `createRoute()` for all routes — this generates the OpenAPI spec automatically from zod schemas
- Instantiate app as `OpenAPIHono` (not `Hono`)
- All admin endpoints require the `admin` role
- The `GET /projects` endpoint is available to ALL authenticated keys (not just admin)
- Nodion API paths use `/env_variables` (NOT `/environment_variables`)
- Use nanoid for generating API key tokens, SHA-256 for hashing
- Drizzle ORM: define schema once in `src/db/schema.ts`, use dialect-agnostic query builder — same code runs on SQLite and PostgreSQL
- `DATABASE_URL` env var switches between PostgreSQL (production) and SQLite (local dev)
- Service accounts are **optional** — `/api/integrations/*` works with project API keys alone, service accounts add sync capabilities
- `/api/integrations/*` aggregates from both project API keys (`/v1/`, read-only) and service accounts (`/ui/v1/`, syncable)
- Integrations from the same project API key appearing via multiple projects are deduplicated by UUID
- Service account sessions are managed in-memory with automatic token rotation (devise_token_auth) and re-auth on 401
