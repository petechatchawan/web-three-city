# ADR-0004: Keep Targeted Verification and Separate Relevant Browser CI

**Status:** Accepted  
**Date:** `2026-08-07`  
**System:** `architecture-infrastructure`

## Context

The repository already defines a Level 0-4 Verification Ladder in `AGENTS.md`. The current root package loop passes 669 unit/package tests, and `pnpm verify` takes about 27 seconds warm. Full browser closure runs 121 tests and took 5.7 minutes locally with two workers.

Playwright currently has one Chromium project, no tags, and a binary `full-ci` label. The Browser CI job invokes `pnpm verify:full`, duplicating install, Lean verification, and builds already performed by Lean CI. Raising Playwright workers blindly could weaken deterministic behavior.

## Decision

Use package-targeted verification as the normal development loop and preserve the highest-required-level final gate. Add browser ownership tags/projects and relevant-system subsets only after classifying current tests. Keep a full release project for Level 4.

Where CI jobs share identical builds, prefer deterministic artifact sharing or a clearly defined dependency between Lean and Browser jobs over rerunning the entire Lean gate. Keep the current deterministic worker policy until measurements prove a safe change.

## Consequences

### Positive

- Local implementation feedback remains seconds-to-low-minutes rather than repository-wide.
- RCI, Roads, Water, or other changes can run relevant browser coverage without claiming unrelated visual tests.
- Full release coverage remains available and explicit.
- CI avoids duplicated install/build work without changing application behavior.

### Negative

- Tag/project ownership must be maintained as browser tests grow.
- Relevant browser selection must be conservative; an omitted behavior is worse than an extra test.
- Artifact sharing introduces CI plumbing and cache/debugging concerns.
- Timing targets remain measurements, not correctness shortcuts.

## Alternatives Considered

### Run every browser test for every PR

Rejected as the normal loop. It is safe but wastes wall-clock time and encourages developers to skip verification.

### Increase one Playwright job to many workers

Rejected initially. Current `fullyParallel: false` and two-worker policy exist for determinism; more workers are not a free optimization.

### Remove full browser verification

Rejected. Level 4 release and milestone closure remains mandatory when triggered.

### Adopt Nx/Turborepo immediately

Rejected. First measure relevant browser and package graph savings with repository-native mechanisms.

## Enforcement

- `AGENTS.md` remains normative for escalation.
- Playwright contract tests assert deterministic full-project settings and required release coverage.
- Browser ownership tags must map to existing system vocabulary.
- CI changes require exact-head verification and a before/after timing record.
- No relevant subset may replace the full Level 4 project.

## Supersession

A future CI architecture may supersede this decision after actual wall-clock, coverage, determinism, and failure-diagnosis evidence is recorded in a new ADR.
