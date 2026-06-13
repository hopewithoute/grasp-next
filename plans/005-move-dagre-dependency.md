# Plan 005: Move Dagre Dependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3cae365..HEAD -- package.json apps/web/package.json`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `3cae365`, 2026-06-14

## Why this matters

The `dagre` package and `@types/dagre` are installed in the root `package.json`. However, they are specific to the web frontend (XYFlow graph visualization). This violates monorepo boundaries where dependencies should be localized to the workspace that actually uses them.

## Current state

- `package.json` (root) contains `dagre` and `@types/dagre`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Lint      | `pnpm lint`              | exit 0              |

## Scope

**In scope**:
- `package.json` (root)
- `apps/web/package.json`
- `pnpm-lock.yaml`

**Out of scope**:
- Changing any source code.

## Steps

### Step 1: Remove from root

Run `pnpm remove -w dagre @types/dagre`.

### Step 2: Add to apps/web

Run `pnpm add dagre` and `pnpm add -D @types/dagre` inside `apps/web/`.

**Verify**: `pnpm typecheck` → exit 0.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `dagre` is no longer in root `package.json`.

## STOP conditions

- If `dagre` is imported in packages other than `apps/web`, STOP and report.
