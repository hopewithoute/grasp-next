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

## Local Service Scripts (`services/evidence-kb`)

For ease of running the Python FastAPI backend, a local `./run` script is available inside `services/evidence-kb`.
You can run it to launch the server (`./run dev`), run pytest (`./run test`), run integration tests (`./run test-integration`), lint/format code (`./run lint`, `./run format`), and manage database migrations (`./run db-init`, `./run db-migrate`).

## TypeScript Compilation Constraints

**CRITICAL**: Do NOT use `tsc` directly in the terminal for type checking or compilation operations. Two of the last tasks crashed due to out-of-memory (OOM) errors during `tsc`.

Instead, **always use `tsgo`** for all TypeScript operations in the terminal to avoid memory crashes.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
