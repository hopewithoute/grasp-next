---
name: chrono-prd-indexer
description: Use when a user provides a PRD, product spec, brief, feature proposal, or roadmap and wants it converted into a feature index, initial feature memory, decision seeds, risks, open questions, and implementation slices for AI-assisted development.
---

# Chrono PRD Indexer

Convert a PRD or product spec into a feature-scoped continuity structure.

The goal is not only to create tasks. The goal is to create initial feature memory: intent, user stories, acceptance criteria, risks, open questions, dependencies, and suggested slices.

## Default mode

Read and structure. Do not implement code.

## Inputs

Accept any of these:

- PRD text
- product brief
- design spec
- user story list
- roadmap notes
- issue cluster
- early feature idea

## Outputs

Create or draft:

```text
docs/features/FEATURE_INDEX.md
docs/features/<feature-slug>/prd.md
docs/features/<feature-slug>/feature-chronicle.md
docs/features/<feature-slug>/decision-vault.md
docs/features/<feature-slug>/tracker.md
docs/features/<feature-slug>/risks-and-open-questions.md
```

For small projects, a single consolidated `FEATURE_INDEX.md` is acceptable.

## Workflow

1. Identify feature candidates from the PRD.
2. Separate feature, sub-feature, user story, workflow, and implementation task.
3. Create a feature index with status, source section, and memory path.
4. For each feature, extract intent, users, use cases, acceptance criteria, non-goals, risks, and open questions.
5. Seed initial decisions only when they are explicit in the PRD.
6. Mark unclear items as assumptions or open questions.
7. Suggest small implementation slices ordered by dependency and risk.
8. Flag items that may require ADRs.

## Classification rules

Use these categories precisely:

```text
Feature         = user-visible or domain-visible capability
Sub-feature     = part of a feature that can be built/reviewed separately
User story      = user goal or job-to-be-done
Acceptance      = externally verifiable condition
Decision seed   = explicit product/technical direction in the PRD
Assumption      = plausible but unverified interpretation
Open question   = something that needs human/product decision
Slice           = bounded implementation step
```

## Required output sections

For each feature, produce:

```md
# Feature: <Name>

## Intent

## Users / Actors

## User Stories

## Acceptance Criteria

## Non-goals

## Dependencies

## Decision Seeds

## Risks

## Open Questions

## Suggested Slices

## Initial Chronicle Entry
```

Use templates from `assets/` when creating files.

## Evidence discipline

Quote or cite PRD sections when possible. If the PRD does not say something, do not invent it. Label it as an assumption or open question.

## Human review handoff

End with a review checklist:

```text
Please confirm:
- Are these the right feature boundaries?
- Are any features missing or merged incorrectly?
- Which assumptions should be accepted or rejected?
- Which suggested slices should be first?
- Should any decision seeds become ADRs?
```

## Common mistakes

Avoid:

- turning every bullet into a feature
- turning implementation ideas into product requirements
- inventing acceptance criteria not implied by the PRD
- mixing feature memory with detailed code design too early
- creating huge slices that exceed human review capacity
