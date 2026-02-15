# Nodion Gateway

RBAC proxy for the [Nodion](https://www.nodion.com/) PaaS API. Nodion API keys have no scopes or roles — a single key can do everything. This gateway sits between clients and the Nodion API, issuing its own scoped API keys with fine-grained permissions.

## Features

- **Role-based access control** — 4 roles: `admin`, `agent`, `deployer`, `readonly`
- **Multi-project support** — manage multiple Nodion projects centrally
- **Resource ownership** — track which key created which app
- **Blocklist** — protect production apps from accidental deletion
- **Audit log** — every request is logged
- **OpenAPI spec** — auto-generated with Swagger UI at `/docs`
- **MCP integration** — AI tool support via Model Context Protocol

## Quick Start

### Docker

```bash
docker build -t nodion-gateway .
docker run -d --name nodion-gateway -p 3000:3000 \
  -e ADMIN_BOOTSTRAP_KEY=my-secret-admin-key \
  -v gateway-data:/data \
  nodion-gateway
```

### Local Development

```bash
npm install
cp .env.example .env   # Edit with your settings
npm run dev
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODION_API_BASE_URL` | `https://api.nodion.com/v1` | Nodion API base URL |
| `PORT` | `3000` | Gateway port |
| `ADMIN_BOOTSTRAP_KEY` | *(required)* | Initial admin key (registered on first start) |
| `DB_PATH` | `./data/gateway.db` | SQLite database path |

Nodion API keys are stored per project in the database, managed via `POST /admin/projects`.

## Usage

### 1. Register a Nodion project

```bash
curl -X POST http://localhost:3000/admin/projects \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "my-project", "label": "My Project", "nodionApiKey": "nodion-key-here"}'
```

### 2. Create a scoped API key

```bash
curl -X POST http://localhost:3000/admin/keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "CI Pipeline", "role": "deployer", "projects": ["my-project"]}'
```

### 3. Use the proxy

```bash
# List applications (through the gateway)
curl http://localhost:3000/projects/my-project/applications \
  -H "Authorization: Bearer $DEPLOYER_KEY"

# Trigger a deployment
curl -X POST http://localhost:3000/projects/my-project/applications/APP_ID/deployments \
  -H "Authorization: Bearer $DEPLOYER_KEY"
```

## Roles

| Role | GET | POST | PATCH | DELETE |
|------|-----|------|-------|--------|
| admin | everything | everything | everything | everything |
| agent | apps, regions, types | apps, deployments, env vars, scaling | env vars | apps, env vars |
| deployer | apps, regions, types | deployments only | — | — |
| readonly | apps, regions, types | — | — | — |

## API Documentation

Visit `/docs` for the interactive Swagger UI, or `/openapi.json` for the raw spec.

## License

MIT
