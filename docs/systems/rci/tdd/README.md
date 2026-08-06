# RCI Demand & Occupancy v0.1 — TDD Execution Packet

**Status:** Executed and closed  
**Approved specification:** [`../specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md`](../specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md)  
**Owning system:** [`../README.md`](../README.md)  
**Closure record:** [`../verification/2026-08-06-rci-foundation-v0-1-closure.md`](../verification/2026-08-06-rci-foundation-v0-1-closure.md)

## Purpose

This packet decomposed RCI Foundation v0.1 into six sequential TDD implementation boundaries. Every production change followed RED → GREEN → REFACTOR → focused verification before merge.

The packet is retained as implementation history and handoff context. It is no longer an active plan.

## Execution Outcome

| Order | Plan | Pull request | Result |
|---:|---|---:|---|
| 1 | [Core contracts, registries, snapshots, and Save V1](2026-08-06-rci-pr1-core-contracts-snapshots-save-v1.md) | #26 | Merged |
| 2 | [Population, relationships, households, and daily lifecycle](2026-08-06-rci-pr2-population-relationships-lifecycle.md) | #27 | Merged |
| 3 | [Housing, migration, relocation, and displacement](2026-08-06-rci-pr3-housing-migration-displacement.md) | #28 | Merged |
| 4 | [Workplaces and Employment reconciliation](2026-08-06-rci-pr4-workplaces-employment.md) | #29 | Merged |
| 5 | [Demand and Building Growth policy](2026-08-06-rci-pr5-demand-growth-policy.md) | #30 | Merged |
| 6 | [Atomic game integration, HUD, browser acceptance, and final verification](2026-08-06-rci-pr6-game-integration-hud-verification.md) | #31 | Merged |

Final foundation baseline:

```text
master commit  9409e301d2710db856b584fc555d5c4f714bba62
verified tree  75a04d244a3e27a7f6a89d46f90bd676d60626d4
CI run         31111324705 — PASS
browser        121 passed
```

## Binding Contracts Retained After Implementation

1. Foundation definitions are exposed through explicit registries; generic registry construction remains internal.
2. Annual probabilities use integer millionths in `0..1_000_000`.
3. Capacity profile IDs use the canonical `capacity.` prefix.
4. Relocation and incoming materialization require a wholly vacant Dwelling Unit with adequate resident capacity.
5. `GameWorldStateStore` owns atomic storage; cross-domain validation occurs before replacement.
6. `RciSaveV1` uses named revision fields and is persisted inside `WorldSaveV5`.
7. `building-core` and `simulation-core` do not import `rci-core`.
8. Background Growth cannot alter active tools, previews, pointer sessions, undo history, or HUD mode.
9. Ordering-sensitive behavior and fixed-point calculations remain deterministic.
10. Invalid, failed, or stale plans publish no partial state and consume no sequence values.

## Verification Records

- [PR 1 — Core contracts and Save](../verification/2026-08-06-rci-pr1-core-contracts-save-v1.md)
- [PR 2 — Population lifecycle](../verification/2026-08-06-rci-pr2-population-lifecycle.md)
- [PR 3 — Housing and migration](../verification/2026-08-06-rci-pr3-housing-migration.md)
- [PR 4 — Workplaces and Employment](../verification/2026-08-06-rci-pr4-workplaces-employment.md)
- [PR 5 — Demand and Growth policy](../verification/2026-08-06-rci-pr5-demand-growth.md)
- [PR 6 — Game integration](../verification/2026-08-06-rci-pr6-game-integration.md)
- [Foundation closure](../verification/2026-08-06-rci-foundation-v0-1-closure.md)

## Post-Closure Correction

The packet's original Demand target-buffer implementation permitted a fully-occupied Growth deadlock. PR #32 corrects that behavior under a focused regression and separate verification record:

- [Fully-occupied R/C/I Growth deadlock](../verification/2026-08-06-rci-occupied-dwelling-demand-deadlock.md)

This correction does not change the normalized entity model, package boundaries, tick pipeline, or Save schema.
