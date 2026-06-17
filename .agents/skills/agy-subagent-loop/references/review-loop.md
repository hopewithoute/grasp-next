# Review Loop

After `agy` returns, Codex must review before relying on it.

## Read-Only Result

- Check whether the answer actually addresses the delegated task.
- Verify path and API names against the local repo when the claim matters.
- Treat unsupported claims as hypotheses.
- If the result conflicts with local code, prefer local code and explain the conflict.

## Implementation Result

- Run `rtk git status` and inspect the changed files.
- Confirm edits are inside the allowed write scope.
- Check for unrelated reformatting, broad refactors, or reverted user changes.
- Read the modified code before running tests.
- Run targeted verification that matches the task risk.
- If verification fails, fix locally or send one focused follow-up to `agy`.

## Final Reporting

Include:
- What `agy` was asked to do.
- Which parts Codex accepted, changed, or rejected.
- What Codex verified directly.
- What remains unverified or risky.
