# Agy Handoff Contract

Use this shape for non-trivial handoffs.

```md
# Role
You are an external agy subagent assisting Codex. Codex remains responsible for final verification and final answer.

# Task
<one concrete outcome>

# Repo
- Path: /var/www/grasp-next
- Current branch/status: <optional, include only if relevant>

# Context
- Relevant files:
  - <path>: <why it matters>
- Relevant docs:
  - <path>: <why it matters>
- Known constraints:
  - Use project conventions.
  - Keep changes surgical.
  - Use `rtk` prefixes for terminal commands in this repo.
  - Do not run `tsc`; use `tsgo` for TypeScript checks.

# Permissions
- Mode: read-only | implementation allowed
- Allowed write scope:
  - <paths or modules>
- Do not touch:
  - <paths or concerns>
- Do not revert unrelated user or agent changes.

# Expected Output
Return concise sections:
- Findings or result
- Evidence with file paths and line references when available
- Changes made, if any
- Commands run and outcomes
- Remaining uncertainty or risks
```

Keep the prompt small. Prefer specific file paths over pasted source unless the exact text is essential.
