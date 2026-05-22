---
name: chrono-decision-promoter
description: Use when a feature-level decision, implementation rule, constraint, or repeated pattern may affect multiple features and should be evaluated for promotion into an ADR or system-wide engineering standard.
---

# Chrono Decision Promoter

Evaluate whether a feature-level decision should remain local or be promoted to an architecture decision record.

Feature chronicles capture local continuity. ADRs capture system-wide architectural decisions. This skill protects against both extremes: hiding architectural decisions inside one feature, and over-promoting every small decision into ADR noise.

## Default mode

Read and propose. Do not create or modify ADRs unless the user asks.

## Inputs

Any of these:

- decision vault entry
- feature chronicle entry
- review comment
- repeated implementation pattern
- drift report
- refactor proposal
- user question such as “should this be ADR?”

## Promotion criteria

Promote when a decision:

- affects multiple features or teams
- creates a reusable architectural boundary
- changes data ownership, auth, security, persistence, API contracts, deployment, or integration strategy
- imposes a rule future work must follow across the codebase
- resolves a recurring debate
- changes system risk profile

Keep feature-level when a decision:

- affects only one feature
- is temporary or experimental
- is a local implementation nuance
- does not constrain other subsystems
- is not yet validated

## Workflow

1. Read the decision and evidence.
2. Identify scope of impact.
3. Check whether similar decisions appear in other features.
4. Classify as feature-level, ADR candidate, or needs more evidence.
5. If ADR candidate, produce a proposed ADR outline.
6. Identify feature chronicle entries that should link to the ADR.
7. Ask for human approval.

## Required output

```md
# Decision Promotion Review

## Decision Under Review

## Current Scope

## Impact Analysis

## Recommendation

## Rationale

## Suggested ADR Candidate

## Feature Links

## Human Review Required
```

Use templates from `assets/`.

## Recommendation values

```text
keep feature-level
promote to ADR
needs more evidence
split decision
supersede existing ADR
link to existing ADR
```

## Common mistakes

Avoid:

- promoting every small tradeoff to ADR
- hiding auth/security/data decisions inside feature docs only
- writing ADRs without consequences
- losing the original feature context after promotion
- treating proposed decisions as accepted architecture
