# Documentation System

**Status:** Implemented on `docs/rci-demand-occupancy-v0-1-planning`  
**Primary ownership:** repository maintainers and every system owner  
**Persistence:** Git history

## Purpose

Provide a concise, system-centric handoff that explains current behavior and keeps design history, decisions, implementation plans, and verification near the system they describe.

## Does Not Own

- Product requirements that have not been approved.
- Runtime truth that belongs in source contracts and tests.
- Duplicated copies of milestone specifications.
- Generated API reference documentation.

## Current Capabilities

- A registry of current, planned, and deprecated systems.
- One living `README.md` per system.
- Per-system `specs/`, `adrs/`, `tdd/`, and `verification/` locations.
- Shared templates and status vocabulary.
- A phased migration policy for legacy `docs/superpowers/` artifacts.
- A same-PR update rule for behavior, contract, ownership, and persistence changes.

## Authority

`docs/systems/README.md` owns navigation and documentation governance. Each `docs/systems/<system>/README.md` owns the current handoff for that system. Source and tests remain authoritative for executable details; the overview summarizes and links to them.

## Main Workflow

1. A system design is approved and stored under the owning system's `specs/`.
2. Durable choices receive ADRs only when the reasoning must survive beyond one milestone.
3. The TDD plan is stored under `tdd/`.
4. Implementation PRs update the living overview alongside behavior.
5. Final evidence is stored under `verification/`.
6. Superseded documents remain in history and point to their replacements.

## Invariants

- One canonical full copy of each document.
- Planned behavior is never described as implemented.
- Living overviews remain concise and handoff-oriented.
- Historical specs and ADRs are not rewritten to simulate current state.
- Links use repository-relative paths.
- Empty organizational layers are not created without an artifact.

## Current Limitations

Historical system documents still under `docs/superpowers/` require phased classification and migration. This foundation does not rewrite every legacy document in one PR.

## Related Documents

- [Registry and governance](../README.md)
- [Foundation specification](specs/2026-08-06-living-system-documentation-foundation-v0-1.md)
- [ADR-0001](adrs/0001-system-centric-documentation.md)
- [Implementation plan](tdd/2026-08-06-living-system-documentation-foundation-v0-1.md)
