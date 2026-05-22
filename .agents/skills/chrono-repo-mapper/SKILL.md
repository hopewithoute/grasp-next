---
name: chrono-repo-mapper
description: "Use to backfill an existing software repository into feature chronicles: detect features, map implementation and tests, reconstruct current behavior, infer decisions with confidence labels, identify risks, and create a feature continuity layer."
---

# Chrono Repo Mapper

Map the current state of a repository into feature-scoped continuity documentation.

This skill is for existing codebases where feature memory does not exist or is incomplete.

## Default mode

Read-only. Do not modify source code.

## Goal

Create draft feature chronicles that explain:

```text
what exists
where it lives
how it behaves now
what tests protect it
what decisions can be observed or inferred
where spec drift or risk exists
what future work should respect
```

## Workflow

1. Inventory repository structure.
2. Detect feature candidates from routes, modules, services, models, tests, docs, and repeated terminology.
3. Create or update a feature index draft.
4. For each feature, create an implementation map.
5. Reconstruct current behavior from code and tests.
6. Build a test map and identify missing coverage.
7. Extract explicit decisions from docs/ADRs/issues if available.
8. Infer likely decisions only when supported by evidence; label confidence.
9. Inspect git history when available and useful.
10. Create risks, open questions, and suggested next slices.

## Output structure

```text
docs/features/FEATURE_INDEX.md
docs/features/<feature-slug>/feature-chronicle.md
docs/features/<feature-slug>/current-behavior.md
docs/features/<feature-slug>/decision-vault.md
docs/features/<feature-slug>/implementation-map.md
docs/features/<feature-slug>/test-map.md
docs/features/<feature-slug>/risks-and-open-questions.md
docs/features/<feature-slug>/evolution-log.md
```

Use templates from `assets/`.

## Evidence categories

```text
Observed fact      = directly supported by code, tests, docs, git, PR, or issue
Inferred decision  = likely rationale, explicitly labeled
Assumption         = plausible but unverified
Open question      = needs human confirmation
```

Use confidence labels: High, Medium, Low.

## Human review handoff

End with the top 5 review items:

```text
1. Highest-risk inferred decision
2. Biggest spec/code mismatch
3. Most important missing test
4. Feature boundary that needs confirmation
5. Decision that may need ADR promotion
```

## Common mistakes

Avoid:

- inventing historical reasons
- documenting line-by-line implementation
- marking inferred decisions as accepted
- generating too much prose to review
- ignoring tests when describing behavior
- treating stale docs as current behavior without checking code
