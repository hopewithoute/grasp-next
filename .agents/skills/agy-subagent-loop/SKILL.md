---
name: agy-subagent-loop
description: Use when the user asks Codex to delegate work to agy, use agy as a subagent, create a context handoff to agy, or run a Codex to agy to review result loop. Applies to exploration, review, verification, and bounded implementation tasks where Codex remains responsible for final judgment.
---

# Agy Subagent Loop

Use `agy` as an external delegated agent. It is not a native Codex subagent: Codex owns the plan, context handoff, verification, and final answer.

## Workflow

1. Decide whether delegation helps.
   - Use `agy` only when the user explicitly asks for `agy`, external delegation, or an `agy` subagent loop.
   - Keep urgent blocking work local if the next Codex step depends on it.
   - Prefer bounded sidecar tasks: focused review, second-opinion diagnosis, repo search, small implementation in a disjoint write scope, or independent verification.

2. State the local assumptions and success criteria before the handoff.
   - Name what `agy` should answer.
   - Name what Codex will verify afterward.
   - For `/var/www/grasp-next`, keep using `rtk` command prefixes.

3. Build a bounded handoff prompt.
   - Read `references/handoff-contract.md` when drafting a non-trivial handoff.
   - Include repo path, task, relevant files, constraints, allowed write scope, disallowed actions, and expected output.
   - If edits are allowed, require `agy` to list changed files and verification performed.

4. Run `agy` from the target repo cwd.
   - Preferred helper:

     ```bash
     rtk .agents/skills/agy-subagent-loop/scripts/run-agy-handoff.sh /tmp/agy-handoff.md
     ```

   - Direct fallback:

     ```bash
     rtk agy --print "$(cat /tmp/agy-handoff.md)" --print-timeout 5m
     ```

5. Review the result before acting.
   - Read `references/review-loop.md` for the review checklist.
   - Do not blindly trust claims about files, commands, tests, or behavior.
   - Inspect diffs if `agy` edited files.
   - Run targeted verification when practical.

6. Refine once if useful.
   - If `agy` missed the point, send one focused follow-up with concrete gaps.
   - Avoid long back-and-forth loops unless the user explicitly wants that.

7. Finalize from Codex.
   - Summarize what came from `agy`, what Codex verified, what changed, and what remains uncertain.
   - Be explicit if `agy` was read-only, if edits were skipped, or if verification was not run.

## Safety Defaults

- Default `agy` tasks to read-only unless the user asks for implementation.
- For implementation, give `agy` a disjoint write scope and remind it not to revert other work.
- Keep secrets, tokens, and private credentials out of handoff prompts.
- Do not pass huge context dumps. Pass file paths and concise constraints; let `agy` inspect locally when possible.
- Codex must make the final call. Treat `agy` output as input evidence, not authority.
