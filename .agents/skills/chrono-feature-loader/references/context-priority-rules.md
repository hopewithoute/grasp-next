# Context Priority Rules

Load context in this order:

1. feature index
2. feature chronicle summary/current behavior
3. accepted decisions in decision vault
4. current tracker/slice
5. implementation map
6. test map
7. risks/open questions
8. relevant ADRs
9. source code files for the active slice
10. git history only if needed

## Relevance filter

Prefer feature-scoped docs over global docs. Prefer accepted decisions over raw discussion. Prefer tests over comments when describing guaranteed behavior.

## Staleness check

If code and docs disagree, say so. Treat code/tests as current behavior evidence and docs as intent/context evidence until reconciled.
