# Session Sources and Normalization

## Source priority

1. human-approved review comments
2. merged PR description
3. passing tests and assertions
4. final diff
5. commit messages
6. conversation summary
7. raw agent suggestions

## Normalize noisy conversations

Extract only:

- final accepted direction
- facts discovered
- rejected approaches
- behavior changed
- tests/evidence
- remaining risks
- next slice

Do not preserve rambling, abandoned ideas, or hallucinated claims unless they explain a rejected approach.
