# Evidence KB Docs

This directory holds service-specific reference material for `services/evidence-kb`.

## Start Here

- `../README.md`
  Service-level overview, local setup, common commands, and endpoint summary.
- `reference.md`
  Detailed API, storage, and model reference for the current `evidence-kb` implementation.

## When To Use Which Doc

- Use `../README.md` when you need to run the service, configure it locally, or understand the high-level ingestion and retrieval flow.
- Use `reference.md` when you need endpoint details, request/response shapes, or storage-level behavior.

## Notes

- The web app consumes this service through `apps/web/server/evidence-kb.ts`.
- The generated TypeScript client is derived from the service OpenAPI schema and committed under `apps/web/api-client/`.
