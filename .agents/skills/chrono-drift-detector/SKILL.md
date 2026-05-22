---
name: chrono-drift-detector
description: Use to compare PRD/spec, feature chronicle, decision vault, current code, tests, issues, or PRs and detect spec drift, behavior drift, undocumented implementation nuance, stale docs, and decisions needing review.
---

# Chrono Drift Detector

Detect and classify drift between intended design, documented continuity, implementation reality, and tested behavior.

This skill is useful before refactors, after large changes, during maintenance, or when a user suspects the spec no longer matches the code.

## Default mode

Read-only analysis. Do not modify code.

## Inputs

Any combination of:

- PRD/spec
- feature chronicle
- decision vault
- implementation files
- tests
- issue/PR references
- release notes
- user bug report

## Drift dimensions

Compare:

```text
PRD/spec intent
vs accepted feature memory
vs current implementation
vs tests
vs released/user-facing behavior
```

## Workflow

1. Identify the target feature.
2. Load PRD/spec and feature memory.
3. Load current implementation and tests relevant to the feature.
4. Extract intended behavior, documented behavior, implemented behavior, and tested behavior.
5. Build a drift table.
6. Classify each drift.
7. Identify whether drift is accepted, risky, undocumented, or needs product/engineering review.
8. Suggest updates: PRD update, chronicle update, test addition, code fix, or ADR promotion.

## Drift classification

Use these labels:

```text
accepted implementation drift
undocumented implementation nuance
stale spec
stale chronicle
hidden behavior drift
test coverage drift
temporary workaround
rejected approach resurfaced
needs human decision
```

## Required output

```md
# Feature Drift Report

## Target Feature

## Sources Compared

## Summary

## Drift Table

## Accepted Drift

## Risky Drift

## Stale or Missing Documentation

## Missing Tests

## Decisions Needing Review

## Recommended Actions
```

Use `assets/drift-report-template.md`.

## Evidence discipline

Every drift claim must include evidence. If evidence is weak, label confidence low.

## Common mistakes

Avoid:

- treating all drift as bad
- changing code before deciding whether docs or implementation should change
- assuming PRD is always right
- assuming implementation is always intentional
- ignoring tests as behavior evidence
