# Grasp

Grasp is a monorepo for an adaptive learning studio built around project-based authoring, evidence-backed source ingestion, and concept graph workflows.

## Repo Shape

- `apps/web`
  Next.js application for project authoring, concept graph workspace, evidence explorer, and review flows.
- `packages/domain`
  Domain actions and cross-app business logic.
- `packages/ai`
  AI-facing tools and refinement integrations used by the web app.
- `packages/db`
  Database repositories and persistence layer for app/domain concerns.
- `services/evidence-kb`
  Python FastAPI service for ingestion, passage storage, retrieval, curation, and topic graph generation.
- `services/embedding-sidecar`
  Local embedding runtime used by `evidence-kb` when OpenAI-compatible embeddings are needed.
- `docs`
  Product, feature, and architecture documentation.

## Primary Docs

- [docs/prd.md](/var/www/grasp-next/docs/prd.md:1)
  Product requirements and the current MVP direction.
- [docs/feature_tracker.md](/var/www/grasp-next/docs/feature_tracker.md:1)
  Feature-by-feature implementation status.
- [services/evidence-kb/README.md](/var/www/grasp-next/services/evidence-kb/README.md:1)
  Setup and API overview for the ingestion/retrieval backend.
- [services/evidence-kb/docs/README.md](/var/www/grasp-next/services/evidence-kb/docs/README.md:1)
  Entry point for deeper `evidence-kb` reference docs.

## Quick Start

### Prerequisites

- Node.js compatible with `pnpm@10.33.0`
- `pnpm`
- Python `3.14+` for `services/evidence-kb`
- PostgreSQL for app and service data

### Install workspace dependencies

```bash
pnpm install
```

### Start the monorepo dev loop

```bash
pnpm dev
```

### Common root commands

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

## Working On `evidence-kb`

Use the local helper inside the service directory:

```bash
cd services/evidence-kb
./run dev
./run test
./run test-integration
./run db-migrate
```

For more detail, start with [services/evidence-kb/README.md](/var/www/grasp-next/services/evidence-kb/README.md:1).

## Workspace Notes

- The repo uses `pnpm` workspaces and Turborepo.
- Root scripts orchestrate work across `apps/*`, `packages/*`, and `services/*`.
- The web app consumes the ingestion/retrieval backend through `apps/web/server/evidence-kb.ts`.
- The committed OpenAPI schema at `openapi.json` is used to generate the TypeScript client under `apps/web/api-client/`.

## Current Focus

The current backend-heavy workflow centers on:

- ingesting project sources into `services/evidence-kb`
- surfacing passages and curation controls in the web app
- generating a topic graph from ingested evidence
- refreshing project activity and graph state through project-scoped ingestion run updates
