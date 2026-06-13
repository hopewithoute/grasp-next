# Plan 001: Fix Knowledgebase Proxy Crash

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3cae365..HEAD -- packages/db/src/knowledgebase-repository.ts apps/web/server/project-deps.ts packages/domain/src/projects/load-project-detail.action.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: HIGH
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3cae365`, 2026-06-14

## Why this matters

The `createKnowledgebaseRepository` in the DB package has been replaced by the LGS service, but it returns a Proxy that throws an error on any method call. However, `load-project-detail.action.ts` checks if `deps.knowledgebaseRepository` exists and calls `findCurrentGraphByProject`, which hits the proxy and throws "The legacy web database knowledgebase repository has been removed", crashing the app in production if the graph is current.

## Current state

- `packages/db/src/knowledgebase-repository.ts` — Creates a proxy that throws on any method call.
- `apps/web/server/project-deps.ts` — Injects this proxy via `knowledgebaseRepository: createKnowledgebaseRepository(db)`.
- `packages/domain/src/projects/load-project-detail.action.ts` — Checks if `deps.knowledgebaseRepository` is truthy, then calls a method on it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Tests     | `pnpm test -- filter`    | all pass            |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/db/src/knowledgebase-repository.ts`
- `apps/web/server/project-deps.ts`
- `packages/domain/src/projects/load-project-detail.action.ts`

**Out of scope** (do NOT touch, even though they look related):
- The LGS service implementation.

## Git workflow

- Branch: `advisor/001-fix-knowledgebase-proxy-crash`
- Commit per step or per logical unit.

## Steps

### Step 1: Remove the proxy from knowledgebase-repository.ts

Modify `packages/db/src/knowledgebase-repository.ts` to export a `null` or a dummy object that explicitly disables it, or completely remove the `createKnowledgebaseRepository` function and `DbKnowledgebaseRepository` type, since they are no longer used.

**Verify**: `pnpm typecheck` → Will fail due to `project-deps.ts`.

### Step 2: Remove the injection in project-deps.ts

Modify `apps/web/server/project-deps.ts` to no longer inject `knowledgebaseRepository`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Remove the relational fallback in load-project-detail.action.ts

Modify `packages/domain/src/projects/load-project-detail.action.ts` to remove the `relationalReadModel` fallback entirely and just return the empty read model or the LGS read model. (Check if `deps.knowledgebaseRepository` can be removed from `LoadProjectDetailDeps`).

**Verify**: `pnpm test` → all pass.

## Test plan

- Ensure existing tests pass.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The codebase has drifted since this plan was written.
- Tests fail and cannot be fixed simply.

## Maintenance notes

This fully removes the legacy relational knowledgebase graph from the load path, relying entirely on LGS.
