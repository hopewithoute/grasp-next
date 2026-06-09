---
name: chrono-feature-loader
description: "Use before implementing, fixing, reviewing, or modifying a feature when the agent should load only the relevant feature-scoped memory: PRD, chronicle, decision vault, current behavior, risks, tracker, tests, and implementation map."
---

# Chrono Feature Loader

Load the smallest useful continuity context for a feature before doing work.

This skill prevents agents from starting from a short prompt or reading the whole repository randomly. It loads feature-scoped memory first, then summarizes constraints that must guide the change.

## Default mode

Read-only context preparation. Do not modify code or docs unless a separate task asks for that.

## Inputs

Accept any of these:

- feature name
- change request
- bug report
- issue ID
- PRD section
- file path or module path
- vague request such as “continue candidate evaluation”

## Search targets

Look for:

```text
docs/features/FEATURE_INDEX.md
docs/features/<feature-slug>/prd.md
docs/features/<feature-slug>/feature-chronicle.md
docs/features/<feature-slug>/current-behavior.md
docs/features/<feature-slug>/decision-vault.md
docs/features/<feature-slug>/implementation-map.md
docs/features/<feature-slug>/test-map.md
docs/features/<feature-slug>/risks-and-open-questions.md
docs/features/<feature-slug>/tracker.md
docs/adr/*.md
```

If no feature memory exists, report that and suggest using `chrono-repo-mapper` or `chrono-prd-indexer`.

## Workflow

1. Identify the target feature.
2. Load the feature index, then the specific feature folder.
3. Load only relevant ADRs, not all ADRs.
4. Extract accepted decisions and active constraints.
5. Extract current behavior and implementation map.
6. Extract tests and missing coverage.
7. Extract risks, open questions, and current slice.
8. Produce a “loaded context brief” before any implementation work.

## Required output

Produce:

```md
# Loaded Feature Context

## Target Feature

## Why This Feature Was Selected

## Current Responsibility

## Current Behavior

## Relevant Decisions

## Active Constraints

## Implementation Map

## Test Map

## Risks / Open Questions

## Current or Suggested Slice

## Work Boundary

## Human Checkpoints
```

Use `assets/loaded-context-brief-template.md`.

## Decision handling

Accepted decisions constrain the change. Proposed or inferred decisions must not be treated as binding unless the user confirms them.

## When feature identity is ambiguous

Do not ask immediately if you can make a reasonable shortlist. Return up to 3 candidates with evidence and recommend one. If the work would be risky, ask for confirmation before modifying code.

## Common mistakes

Avoid:

- loading the whole repository when one feature folder is enough
- ignoring feature-level constraints
- treating inferred decisions as accepted
- proceeding to implementation before summarizing context
- hiding missing or stale memory
