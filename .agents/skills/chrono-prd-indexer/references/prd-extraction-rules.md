# PRD Extraction Rules

## Feature boundary heuristics

A feature usually has one or more of these signals:

- distinct user goal
- distinct screen/workflow/API capability
- independent acceptance criteria
- separate release value
- separate maintenance history
- likely future evolution

## Split when

Split a feature when parts can evolve independently, have separate risks, or require separate review.

## Merge when

Merge when two items are only implementation details of the same user-visible capability.

## Decision seed rules

A decision seed must be explicitly supported by the PRD. If the PRD only implies it, label as assumption.

## Slice ordering

Prefer slices that produce narrow evidence early:

1. pure domain logic
2. API contract
3. persistence
4. UI integration
5. automation/background jobs
6. analytics/observability
7. polish
