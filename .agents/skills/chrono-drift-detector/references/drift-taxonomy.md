# Drift Taxonomy

## accepted implementation drift

The implementation differs from the original spec, but the chronicle/decision vault explains and accepts the change.

## undocumented implementation nuance

The code contains nuance not reflected in PRD or chronicle.

## stale spec

The PRD/spec describes an older intention that no longer matches accepted reality.

## stale chronicle

Feature memory no longer matches code/tests.

## hidden behavior drift

Runtime behavior changed without explicit decision or test coverage.

## test coverage drift

Feature behavior evolved, but tests still protect the old or incomplete behavior.

## temporary workaround

A known compromise exists but lacks review date or removal plan.

## rejected approach resurfaced

A previously rejected approach appears again in code or proposal.

## needs human decision

Evidence is insufficient to decide whether code, docs, or spec should change.
