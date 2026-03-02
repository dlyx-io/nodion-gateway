# Design: Service Account Integration for /ui/v1/ Endpoints

## Problem

Nodion's public API (`/v1/`, API Key auth) does not expose all needed endpoints. Specifically:
- **Integrations Sync** (sync repos/branches) — only via `/ui/v1/`
- **Process CRUD** (create/update/delete) — only via `/ui/v1/` (separate ticket pending with Nodion)

Additionally, integrations are **user-scoped**, not project-scoped. A project's API key exposes the integration of the project owner, but syncing is not possible via `/v1/`. Users who need fresh branch lists (e.g., after creating new Git branches) cannot trigger a sync through the gateway.

## Solution

Introduce **Service Accounts** — Nodion user credentials stored in the gateway database. The gateway maintains `/ui/v1/` sessions to these accounts and exposes otherwise-unavailable endpoints through its own authenticated API.

This is designed to be **optional and removable**: the gateway works fully without any service account configured. Service accounts add sync capabilities and additional integration sources.

## Verified Assumptions (tested 2026-03-02)

| Test | Result |
|------|--------|
| Service account can access integrations via `/ui/v1/` | Yes |
| Service account sees same GitHub repos (via shared GitHub App installation) | Yes — different UUIDs, same repos |
| Sync repos/branches works via service account | Yes |
| Cross-account UUIDs work for app creation | **Yes** — app created with service account's integration/repo/branch UUIDs via project API key |
| Token rotation | Nodion rotates tokens on each response (devise_token_auth), ~14 day expiry |

## Architecture

```
Client → Gateway API (Bearer gateway-key)
                ├── /api/projects/:slug/* → Nodion /v1/ (project API key) [existing]
                ├── /api/integrations/*   → aggregated from:
                │                            ├── Nodion /v1/ per project API key (read-only)
                │                            └── Nodion /ui/v1/ per service account (read + sync)
                └── /api/admin/service-accounts/* → CRUD service accounts [new]
```

## Data Model

### New Table: `service_accounts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `label` | text | Display name (e.g., "dlyx Integration Account") |
| `email` | text | Nodion login email |
| `password_encrypted` | text | Encrypted password |
| `totp_secret_encrypted` | text, nullable | TOTP seed for 2FA (optional, for future use) |
| `created_at` | timestamp | Created at |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/service-accounts` | Create (email, password, label, totpSecret?) |
| GET | `/admin/service-accounts` | List — id, label, email only. **No** password, no TOTP |
| PATCH | `/admin/service-accounts/:id` | Update (password, totpSecret, label) |
| DELETE | `/admin/service-accounts/:id` | Delete |

Credentials are **write-only** — no endpoint to read back password or TOTP secret.

## Session Service

### `src/services/nodion-session.ts`

Internal service managing active `/ui/v1/` sessions:

- **Lazy login**: First login on first request, not on gateway startup
- **In-memory token storage**: Sessions are ephemeral; re-login after restart
- **Token rotation**: After each `/ui/v1/` request, store rotated tokens from response headers
- **Auto re-auth**: On 401, re-login and retry (1x)
- **TOTP support**: If `totp_secret_encrypted` is set, compute 6-digit code via `otpauth` library
- **Per-account sessions**: Each service account has its own token set

### Internal API

```typescript
async function fetchWithSession(
  accountId: string,
  path: string,       // e.g., "/integrations"
  method: string,
  body?: object
): Promise<Response>
```

## Integrations Aggregation

### `GET /api/integrations`

Aggregates integrations from **all sources**:

1. **Project API keys** (`/v1/integrations`) — one call per project, deduplicate by integration UUID, collect project slugs
2. **Service accounts** (`/ui/v1/integrations`) — one call per service account

Response format:

```json
{
  "integrations": [
    {
      "id": "a97b4e56-...",
      "username": "dlyx-admin",
      "service_type": "github",
      "source": { "type": "project", "projects": ["control-center", "directus"] },
      "syncable": false
    },
    {
      "id": "c8c6ec50-...",
      "username": "dlyx-admin",
      "service_type": "github",
      "source": { "type": "service-account", "id": "...", "label": "dlyx Integration Account" },
      "syncable": true
    }
  ]
}
```

**Rules:**
- Project integrations: `syncable: false` (read-only via `/v1/`)
- Service account integrations: `syncable: true`
- Same UUID from multiple projects → merge into one entry with `projects: [...]`
- No cross-source deduplication — project and service account integrations with different UUIDs (even if same GitHub source) appear as separate entries
- Without any service account configured, only project integrations appear — gateway works as before

### Sub-Endpoints

| Method | Gateway Path | Source | Auth |
|--------|-------------|--------|------|
| GET | `/integrations` | Aggregated (all projects + all service accounts) | Any key |
| GET | `/integrations/:id/repositories` | Routed to correct source by integration ID | Any key |
| GET | `/integrations/:id/repositories/:repoId/branches` | Routed to correct source | Any key |
| POST | `/integrations/:id/sync_repos` | Service account only (syncable) | Any key |
| POST | `/integrations/:id/sync_repo` | Service account only (syncable) | Any key |

Sync endpoints return 400 if called on a non-syncable (project) integration.

### Integration Routing

The gateway must know which source owns an integration ID to route sub-requests correctly:
- On `GET /integrations`, build an in-memory lookup: `integration_id → { source_type, account_id | project_slug }`
- Cache with short TTL or invalidate on service account/project changes
- On requests to `/integrations/:id/*`, look up the source and route accordingly

## Removability

When Nodion exposes sync and process endpoints on `/v1/`:
1. Route sync requests through project API keys instead of service account sessions
2. Service accounts become unnecessary
3. Remove `nodion-session.ts`, `service_accounts` table, admin endpoints
4. `/api/integrations/*` continues to work, just backed by `/v1/` only

## Frontend

- Integration dropdowns show label with source hint: "dlyx-admin (control-center)" vs "dlyx-admin (Service Account)"
- Sync button only visible for `syncable: true` integrations
- No changes needed if no service account is configured

## Dependencies

- `otpauth` npm package (for TOTP support, optional/future)
