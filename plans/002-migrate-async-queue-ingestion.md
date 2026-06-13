# Plan 002: Migrate Async Queue Ingestion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3cae365..HEAD -- apps/web/server/source-ingestion-runner.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `3cae365`, 2026-06-14

## Why this matters

Currently, `runSourceIngestion` in `apps/web/server/source-ingestion-runner.ts` is completely synchronous and runs during the request handler lifecycle. This is a severe architectural risk that can lead to timeout errors, data loss, and blocking the web server for large AI processing tasks. Moving this to a background queue will improve resilience and performance.

## Current state

- `apps/web/server/source-ingestion-runner.ts:13-68` executes `deps.lgsService.indexSourceForOwner` synchronously and waits for it to complete before returning.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Tests     | `pnpm test -- filter`    | all pass            |

## Scope

**In scope** (the only files you should modify):
- `apps/web/server/source-ingestion-runner.ts`
- Queue worker or job definitions (to be created or modified based on existing queue tech, e.g. BullMQ).

**Out of scope**:
- Changing the LGS service itself.

## Steps

### Step 1: Identify existing Queue infrastructure

Identify if BullMQ or another queue is used (check `package.json`).

### Step 2: Create a background job for ingestion

Move the `deps.lgsService.indexSourceForOwner` call into a background job processor.

### Step 3: Update `runSourceIngestion` to enqueue the job

Instead of awaiting the result, enqueue the job and return the `ingestionRun.id` to the client so they can poll for status.

**Verify**: `pnpm typecheck` → exit 0.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- No existing queue infrastructure is found.

## Maintenance notes

This changes the API contract for source ingestion to be async. Clients must now poll for `IngestionRun` status.
