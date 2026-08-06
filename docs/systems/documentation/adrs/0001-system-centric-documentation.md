# ADR-0001: Organize Living Documentation by System

**Status:** Accepted  
**Date:** 2026-08-06  
**System:** Documentation

## Context

Dated milestone specifications preserve design intent but do not reliably answer how a system works on the current branch. A flat global folder for all specs and plans also makes long-term handoff difficult as the number of systems and milestones grows.

## Decision

Use `docs/systems/<system>/README.md` as the living handoff for each system. Store that system's specifications, ADRs, TDD plans, and verification records beside it in dedicated subdirectories.

Keep source code and tests authoritative for executable detail. Keep historical documents immutable enough to preserve the decision context. Do not maintain duplicate canonical copies.

## Consequences

### Positive

- A future worker can start from one predictable location.
- Current behavior is separated from historical design intent.
- Artifacts scale by system rather than accumulating in one global folder.
- Cross-system ownership and Save dependencies become easier to audit.
- Planned systems can define boundaries without appearing implemented.

### Negative

- Existing `docs/superpowers/` documents require gradual classification and migration.
- Feature PRs have an additional documentation obligation.
- Cross-system milestones may need links from more than one overview while retaining one owning-system canonical spec.

## Alternatives Considered

### Keep only dated global specifications

Rejected because current state must be reconstructed from multiple historical milestones.

### Maintain one large architecture document

Rejected because it would become difficult to review, frequently conflict, and mix unrelated system changes.

### Duplicate specifications into system folders

Rejected because two canonical copies drift and make review authority ambiguous.

## Enforcement

- The registry defines canonical locations and status vocabulary.
- Feature PR review checks living-overview impact.
- New artifacts are created under the owning system.
- Migration deletes or redirects the old canonical path after links are updated.
- Planned behavior must be labeled explicitly.

## Supersession

A future documentation platform may supersede this layout only if it preserves repository-local history, stable links or redirects, current-state handoff, and per-system ownership.
