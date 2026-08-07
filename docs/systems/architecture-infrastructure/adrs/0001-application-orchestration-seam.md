# ADR-0001: Use Application Orchestration as Cross-System Seam

**Status:** Accepted  
**Date:** `2026-08-07`  
**System:** `architecture-infrastructure`

## Context

The repository is a modular monolith with deterministic domain packages, Three.js adapters, and `apps/game` as composition root. `game-bootstrap.ts` currently owns several unrelated responsibilities because cross-system policy has no explicit application seam. Future systems such as Economy, Utilities, Services, Land Value, Traffic, and Density will increase that pressure.

The existing dependency direction is healthy: core packages are acyclic, `simulation-core` does not import Buildings or RCI, and `building-core` does not import RCI. Reversing that direction would create circular ownership and make targeted verification harder.

## Decision

Use an application/orchestration layer inside `apps/game` as the seam for cross-system coordination. It may coordinate domain planners, compose a complete committed-world read model, own Save/Load commands, coordinate dependent Undo, bridge ticks to domain plans, and synchronize presentation after publication.

The application layer must not duplicate domain authority or move domain rules out of owning `*-core` packages. Module names are provisional; responsibilities and interfaces are binding. The implementation must prefer a small number of deep modules over many pass-through facades.

## Consequences

### Positive

- Cross-system policy has one explicit ownership location.
- Core packages remain independently deterministic and testable.
- Future systems can consume projections without importing each other's internals.
- `game-bootstrap.ts` can be reduced through bounded extraction rather than arbitrary splitting.
- Application-level tests can exercise transaction and publication invariants without browser rendering.

### Negative

- Application modules become responsible for preserving more invariants.
- A complete read model must be designed carefully to avoid becoming a second domain store.
- Existing `apps/game` code must be migrated incrementally and verified at each seam.
- Application tests need explicit fakes/adapters for presentation and storage.

## Alternatives Considered

### Move cross-system rules into core packages

Rejected. It would create cycles such as `rci-core <-> economy-core` and make domain packages own concerns outside their authority.

### Replace `game-bootstrap.ts` with one `GameRuntime` class

Rejected. It would preserve the current coupling behind a new name and create a God Coordinator.

### Add a generic event bus

Rejected. Current workflows require ordered plans, revision fences, atomic publication, and explicit dependent state. Untyped event delivery would hide those contracts.

### Introduce a dependency injection framework

Rejected. The repository has a small number of concrete adapters and no evidence that framework-level container behavior would reduce coupling.

## Enforcement

- Architecture contract tests reject core-to-Three.js, core-to-DOM, package-to-app, and circular imports.
- Application modules import domain contracts through declared package interfaces.
- Domain packages do not import application modules.
- Characterization tests cover publication, Save/Load, Undo, and tick ordering before extraction.
- `AGENTS.md` Level 2 and Level 3 rules govern affected-consumer and final verification selection.
- Every implementation PR updates the owning living README in the same PR.

## Supersession

If a future architecture replaces application orchestration, it must preserve acyclic domain ownership, explicit transaction semantics, deterministic ordering, and a migration path for existing Save files. Add a superseding ADR without rewriting this record.
