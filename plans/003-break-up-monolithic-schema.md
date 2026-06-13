# Plan 003: Break Up Monolithic Schema

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3cae365..HEAD -- packages/db/src/schema.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `3cae365`, 2026-06-14

## Why this matters

The `packages/db/src/schema.ts` file is a monolithic 10k-byte file containing the entire database schema for all domains. This violates modularity, increases merge conflicts, and makes it hard to understand domain boundaries. Breaking it into domain-specific schema files improves maintainability.

## Current state

- `packages/db/src/schema.ts` contains all Drizzle tables (`user`, `session`, `project`, `artifact`, etc.).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |

## Scope

**In scope**:
- `packages/db/src/schema.ts`
- `packages/db/src/schemas/*.ts` (new files)
- `packages/db/src/index.ts`

**Out of scope**:
- Making schema modifications (no new columns or tables, just moving code).

## Steps

### Step 1: Create domain schema files

Create files like `packages/db/src/schemas/auth.schema.ts`, `packages/db/src/schemas/projects.schema.ts`, `packages/db/src/schemas/artifacts.schema.ts`.

### Step 2: Move table definitions

Move the respective Drizzle table exports into these new files.

### Step 3: Re-export from schema.ts

Modify `packages/db/src/schema.ts` to `export * from './schemas/auth.schema';`, etc.

**Verify**: `pnpm typecheck` → exit 0.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `packages/db/src/schema.ts` is now just a re-export file.

## STOP conditions

- If Drizzle relations are complex and require circular dependencies, STOP and report.
