# System Documentation Registry

This directory is the canonical handoff entry point for how each game system works **now**.

Milestone specifications explain what a change intended to build. System overviews explain the current contract after changes are integrated. Keep both, but do not duplicate a full specification in more than one location.

## Documentation layout

```text
docs/systems/<system>/
├─ README.md       # living current-state handoff
├─ specs/          # approved feature and milestone designs
├─ adrs/           # durable architectural decisions
├─ tdd/            # implementation plans and test-first execution plans
└─ verification/   # final evidence, reports, and acceptance records
```

Git does not retain empty directories. Create a subdirectory when its first artifact exists.

## Artifact responsibilities

| Artifact | Answers | Update policy |
|---|---|---|
| `README.md` | What does this system do now, own, call, persist, and expose? | Update in the same PR as behavior or contract changes |
| `specs/` | What was designed for a milestone or major change? | Preserve as a historical design record |
| `adrs/` | Why was a difficult-to-reverse architectural choice made? | Append a superseding ADR; do not rewrite history |
| `tdd/` | How will an approved design be implemented and verified? | Track execution; preserve after completion |
| `verification/` | What proves the delivered behavior and acceptance gates? | Add fresh evidence for each completed milestone |

## Status vocabulary

- **Implemented** — behavior exists on the referenced branch and is verified by source/tests.
- **Partial** — a bounded subset exists; missing capabilities are stated explicitly.
- **Approved design — not implemented** — design is accepted but production behavior does not exist yet.
- **Planned** — boundary or intent is documented; design decisions remain open.
- **Deprecated** — retained for migration/history and no longer the active authority.

## System registry

| System | Status on this branch | Primary ownership | Persistence |
|---|---|---|---|
| [World](world/README.md) | Implemented | `world-core`, `apps/game` orchestration | World envelope |
| [Terrain](terrain/README.md) | Implemented | `terrain-core`, `terrain-three` | `TerrainSaveV1` |
| [Water](water/README.md) | Implemented, derived | `water-core`, `water-three` | Derived from Terrain |
| [Roads](roads/README.md) | Implemented | `road-core`, `road-three` | `RoadSaveV1` |
| [Zoning](zoning/README.md) | Implemented | `zone-core`, `zone-three` | `ZoneSaveV1` |
| [Buildings](buildings/README.md) | Implemented | `building-core`, `building-three` | `BuildingSaveV2` |
| [Simulation Time](simulation-time/README.md) | Implemented | `simulation-core`, game runtime | `SimulationSaveV2`; V1 migration |
| [RCI Demand & Occupancy](rci/README.md) | Implemented | `rci-core` + `apps/game` orchestration | `RciSaveV1` / `WorldSaveV5` |
| [Economy](economy/README.md) | Implemented | `economy-core`; `apps/game` orchestration | `EconomySaveV1` / `WorldSaveV6` |
| [City UI](city-ui/README.md) | Implemented | `apps/game` presentation | None; session-only presentation state |
| [Development Workflow](development-workflow/README.md) | Implemented | root configuration, `.github/`, `AGENTS.md`, development docs | Git-tracked configuration and documentation |
| [Architecture & Infrastructure](architecture-infrastructure/README.md) | Implemented, CLOSED / PASS | repository architecture, application orchestration, verification infrastructure | Git-tracked configuration and documentation |
| [Documentation](documentation/README.md) | Implemented on this branch | repository documentation | Git history |

## Required handoff content

A living system overview must remain concise and cover:

1. purpose and non-responsibilities;
2. owning packages and runtime integration;
3. authoritative and derived state;
4. main workflows and system connections;
5. persistence and migration ownership;
6. invariants, determinism, and failure behavior;
7. current limitations and extension points;
8. links to source, specs, ADRs, TDD plans, and verification.

Do not copy every type or test into the overview. Link to the owning source when details are already authoritative there.

## Change rule

A PR that changes system behavior, public contracts, ownership, Save semantics, dependencies, or extension boundaries must either:

- update the relevant `docs/systems/<system>/README.md`; or
- state explicitly in the PR checklist that system behavior is unchanged.

## Legacy migration

Existing documents under `docs/superpowers/` remain a readable workflow archive while older systems are migrated incrementally. New artifacts belong under the owning system. See [`docs/superpowers/README.md`](../superpowers/README.md) for the compatibility policy.

## Templates

- [System overview](./_templates/system-overview.md)
- [Specification](./_templates/spec.md)
- [ADR](./_templates/adr.md)
- [TDD plan](./_templates/tdd-plan.md)
