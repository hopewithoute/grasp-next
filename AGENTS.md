# AGENTS.md — Project Rules for Codex

These rules apply to every task in this project unless explicitly overridden by a more specific instruction.

Default bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## 1. Think Before Coding

Before editing code:

- State the assumptions you are making.
- Define the intended outcome.
- Identify ambiguity early.
- If multiple interpretations are possible, present them.
- If the task is unclear enough that implementation would be guesswork, stop and ask.

Push back when a simpler or safer approach exists.

Do not proceed from confusion.

## 2. Simplicity First

Write the minimum code that solves the requested problem.

Do not add:

- speculative features
- unnecessary abstractions
- generic frameworks for single-use logic
- unrelated cleanup
- “nice to have” improvements

Before implementing, ask:

> Would a senior engineer consider this overcomplicated?

If yes, simplify.

## 3. Surgical Changes Only

Touch only the files and lines required for the task.

Do not:

- refactor unrelated code
- reformat unrelated files
- rename things unnecessarily
- improve adjacent comments or style
- clean up code you did not affect

Match the existing code style and structure.

## 4. Goal-Driven Execution

For every non-trivial task, define success criteria before making changes.

Success criteria should answer:

- What behavior must change?
- What must remain unchanged?
- How will this be verified?

Do not blindly follow a checklist. Iterate until the success criteria are satisfied or until a blocker is found.

## 5. Use the Model for Judgment, Not Determinism

Use reasoning for:

- classification
- summarization
- extraction
- design tradeoffs
- ambiguity resolution
- review judgment

Use code, tests, shell tools, or deterministic scripts for:

- search
- routing
- retries
- formatting
- mechanical transforms
- counting
- file rewrites
- validation

If code can answer reliably, code answers.

## 6. Respect Token and Context Budgets

Per task budget: approximately 4,000 tokens.  
Per session budget: approximately 30,000 tokens.

If approaching the budget:

- stop expanding scope
- summarize current state
- list what is verified
- list what remains
- ask to continue in a fresh context if needed

Do not silently overrun context.

## 7. Surface Conflicts

If two patterns, APIs, tests, or conventions contradict each other:

- do not blend them
- choose one explicitly
- prefer the more recent, more local, or more tested pattern
- explain the choice
- flag the conflicting pattern for possible cleanup

Consistency beats compromise-by-averaging.

## 8. Read Before Writing

Before adding or changing code, inspect:

- exports
- immediate callers
- nearby tests
- shared utilities
- existing patterns in the same directory
- relevant configuration

Do not assume code is orthogonal just because it looks isolated.

If the structure seems strange, look for why before changing it.

## 9. Tests Must Verify Intent

Tests should encode why the behavior matters, not only what output appears.

A good test should fail if the business logic or intended contract changes incorrectly.

Avoid tests that merely snapshot implementation details unless snapshots are already the project convention.

When changing behavior:

- add or update tests when practical
- prefer targeted tests over broad brittle tests
- explain any skipped tests

## 10. Checkpoint After Significant Steps

After each significant step, maintain a clear internal state:

- what was changed
- what was verified
- what remains
- what risks or uncertainties exist

If you lose track, stop and restate the current state before continuing.

Do not continue from a state you cannot explain.

## 11. Follow Codebase Conventions

Conformance is more important than personal taste.

Follow existing conventions for:

- file layout
- naming
- error handling
- logging
- validation
- testing
- dependency usage
- formatting

If a convention appears harmful, surface the concern. Do not silently fork the style.

## 12. Fail Loud

Do not claim completion if anything was skipped, guessed, or left unverified.

Do not say “tests pass” if:

- tests were not run
- only some tests were run
- tests were skipped
- the test command failed
- the result is uncertain

Always surface:

- skipped work
- failed commands
- uncertainty
- assumptions
- remaining risk

A partial but honest result is better than a confident false completion.

## Default Workflow

For non-trivial tasks, follow this loop:

1. Understand the request.
2. State assumptions and success criteria.
3. Read relevant code before editing.
4. Make the smallest safe change.
5. Run targeted verification.
6. Fix issues found by verification.
7. Summarize exactly what changed and what was verified.

For trivial tasks, use judgment and avoid unnecessary ceremony.

## Final Response Format

When finishing a task, report:

- what changed
- what was verified
- what was not verified, if anything
- any remaining risks or follow-up needed

Be concise but explicit.
