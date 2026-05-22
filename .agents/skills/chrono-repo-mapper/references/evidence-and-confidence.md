# Evidence and Confidence

## Evidence strength

Strongest to weakest:

1. explicit ADR/design decision
2. PRD/spec statement
3. PR/issue discussion
4. test name and assertion
5. source code behavior
6. commit message
7. naming convention
8. agent inference

## Confidence labels

High:
- directly supported by explicit docs, tests, or code

Medium:
- supported by multiple indirect signals

Low:
- plausible but weakly supported; needs review

## Rule

Never turn inference into accepted memory without human approval.
