---
name: chrono-session-updater
description: Use after a coding session, agent conversation, implementation, fix, commit, PR, review, or debugging session to convert the work into a proposed feature chronicle update, decision update, risk note, and next slice.
---

# Chrono Session Updater

Convert a work session into curated continuity memory.

This skill is used after discussion, implementation, fixes, tests, commits, or review. It does not dump the raw conversation. It extracts what future humans and agents need to know.

## Default mode

Produce a proposed update. Do not mark memory as accepted unless a human approves it.

## Inputs

Any combination of:

- conversation transcript or summary
- changed files
- git diff
- commit message
- PR description
- test output
- bug report
- review comments
- user corrections or decisions

## Output

Produce a proposed update for the relevant feature chronicle:

```md
# Proposed Feature Chronicle Update

## Feature

## Session Summary

## Files Changed

## Behavior Changed

## Tests Added or Run

## Decisions Respected

## New Facts Discovered

## New Decision Proposed

## Rejected Approaches

## Risks Introduced or Reduced

## Spec Drift

## Next Suggested Slice

## Human Review Required
```

Use templates from `assets/`.

## Workflow

1. Identify the feature affected by the session.
2. Separate raw discussion from accepted outcomes.
3. Read the current feature chronicle and decision vault if available.
4. Summarize what changed in behavior, not just what files changed.
5. List tests added/run and whether they prove the intended behavior.
6. Extract facts discovered during implementation.
7. Extract decisions made by the human or strongly implied by accepted work.
8. Mark agent-proposed decisions as Proposed, not Accepted.
9. Record rejected approaches and why they were rejected.
10. Detect drift between PRD and implementation.
11. Suggest the next smallest safe slice.
12. Ask for human approval before updating accepted memory.

## Fact vs decision discipline

```text
Fact:
- “The API currently returns `score_breakdown`.”

Decision:
- “Score responses must include criterion-level explanation.”

Assumption:
- “Recruiters prefer explainability over speed.”

Rejected approach:
- “Return only total score.”
```

## Memory acceptance rule

All updates are `Proposed` until a human approves.

When human approves, append to:

```text
feature-chronicle.md
decision-vault.md
risks-and-open-questions.md
evolution-log.md
tracker.md
```

as appropriate.

## Human review handoff

Ask the human to mark each proposed item:

```text
accept
reject
edit
needs evidence
move to ADR
keep feature-level
```

## Common mistakes

Avoid:

- summarizing only commits without explaining behavior
- claiming tests passed if not verified
- preserving noisy chat instead of curated memory
- promoting agent speculation into accepted decisions
- missing rejected approaches
- failing to link the update to feature, issue, PR, or commit
