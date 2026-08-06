# Living System Documentation Foundation v0.1 — Design Specification

**Status:** Approved  
**System:** Documentation  
**Date:** 2026-08-06

## Decision Summary

Adopt a system-centric documentation structure. Every game system has a concise living overview at `docs/systems/<system>/README.md`. Specs, ADRs, TDD plans, and verification artifacts live under that same system.

The overview is the handoff entry point, not a replacement for source, tests, or historical specifications.

## Context

The repository has detailed milestone documents under `docs/superpowers/`, but lacks a reliable current-state page for systems such as Buildings, Zoning, Simulation, and RCI. Returning workers must reconstruct behavior from multiple dated documents and source files, and the root README has already fallen behind merged milestones.

## Goals

- Make current ownership, behavior, integration, persistence, and limitations discoverable in minutes.
- Group change history and implementation artifacts by the system they affect.
- Preserve historical decisions without duplicating full documents.
- Make documentation updates part of feature completion.
- Support handoff to a worker who has no prior conversation context.

## Non-Goals

- Generate API documentation from TypeScript.
- Migrate every historical file in the first PR.
- Replace source code, tests, PR history, or issue tracking.
- Require long narrative documents for small systems.
- Create empty folders merely to reserve names.

## Canonical Structure

```text
docs/systems/<system>/
├─ README.md
├─ specs/
├─ adrs/
├─ tdd/
└─ verification/
```

`README.md` is current and editable. Specs and ADRs are historical records; substantive changes create a new document or explicit supersession.

## Content Standard

A living overview explains:

- purpose and non-responsibilities;
- owning packages and integration layer;
- authoritative versus derived state;
- canonical workflows and dependencies;
- persistence and migration;
- invariants, determinism, and failure behavior;
- extension points and current limitations;
- where to read source, tests, specs, ADRs, and verification.

The overview should generally fit within one to three rendered pages. It links to detailed contracts rather than copying them.

## Status Accuracy

Every overview uses one status from the registry vocabulary. Planned systems state that no runtime authority exists. A feature branch may describe branch-only behavior only when the header identifies that branch.

## Update Governance

A PR that changes behavior, public contracts, package ownership, system dependencies, Save semantics, or extension boundaries updates the relevant overview in the same PR. PR templates or review checklists should distinguish “system behavior unchanged” from “system documentation updated.”

## Legacy Migration

`docs/superpowers/` remains readable as a legacy workflow archive. New artifacts use system-centric paths immediately. Existing files move only after they are classified, links are updated, and duplicate canonical copies are avoided.

Active unmerged documents may move directly because no released `master` path is being invalidated. The RCI design in PR #25 therefore moves into `docs/systems/rci/specs/`.

## Acceptance Criteria

- A registry links every initial system overview.
- Templates exist for overview, spec, ADR, and TDD plan.
- Implemented systems have concise current-state overviews.
- RCI has a planned-state overview and one canonical full specification.
- Economy has a planned boundary without implied implementation.
- Legacy navigation explains the phased migration policy.
- Repository navigation points to the system registry.
- No placeholder text remains in actual system documents.

## Related Documents

- [Documentation overview](../README.md)
- [ADR-0001](../adrs/0001-system-centric-documentation.md)
- [Implementation plan](../tdd/2026-08-06-living-system-documentation-foundation-v0-1.md)
