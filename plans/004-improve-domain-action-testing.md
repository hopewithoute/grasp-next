# Plan 004: Improve Domain Action Testing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3cae365..HEAD -- packages/domain/src/projects/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `3cae365`, 2026-06-14

## Why this matters

Domain actions form the core business logic of the application. While `project-lifecycle-actions.test.ts` exists, many error conditions, edge cases, and boundary cases are untested, leading to potential regressions during refactoring.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `pnpm test -- filter`    | all pass            |

## Scope

**In scope**:
- `packages/domain/src/**/*.test.ts`

**Out of scope**:
- Modifying actual domain action implementations.

## Steps

### Step 1: Identify missing test coverage

Run `pnpm test --coverage` in `packages/domain` to identify branches that are uncovered in actions like `load-project-detail.action.ts` and others.

### Step 2: Write missing tests

Add unit tests to cover error throws, invalid inputs, and boundary states.

**Verify**: `pnpm test` → all pass.

## Done criteria

- [ ] `pnpm test` exits 0
- [ ] Coverage for `packages/domain/src/projects` is improved.
