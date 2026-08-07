# RCI Demand & Occupancy Foundation v0.1 — Closure Record

**Status:** Closed and merged to `master`  
**Closed:** 2026-08-06  
**Final foundation commit:** `9409e301d2710db856b584fc555d5c4f714bba62`  
**Final foundation tree:** `75a04d244a3e27a7f6a89d46f90bd676d60626d4`  
**Current runtime after post-closure correction:** `03cf6a1d1702ec75d532e0f428b2044914156bba`

## Implemented Scope

- Citizen authority and historical presence.
- Household membership and Relationship graph.
- Deterministic age, qualifications, fertility, mortality, birth, and death.
- Residential capacity, Dwelling inventory, housing assignments, relocation, displacement, incoming migration, and Household emigration.
- Workplace inventory, position capacities, Employment assignments, stability-first matching, and controlled upgrades.
- Fixed-point R/C/I Demand, smoothing, persisted hysteresis gates, and caller-supplied Building Growth policy.
- Atomic Simulation/Building/RCI game tick.
- `WorldSaveV5` persistence and V1–V4 migration.
- Compact RCI HUD, browser acceptance, Save/resume coverage, and 5,000-Citizen deterministic baseline.

## Explicitly Outside v0.1

Economy, taxes, wages, profitability, utilities, city services, traffic, Land Value, abandonment, density upgrades, Education gameplay, Citizen movement AI, and final art content.

## Sequential Merge Record

| Implementation boundary | Pull request | Squash-merge commit |
|---|---:|---|
| Core contracts, registries, snapshots, and Save V1 | #26 | `10bfa64bbb91e678f460b11ce2e022ee3ad1be14` |
| Population, relationships, households, and lifecycle | #27 | `e44c98d70efcf614cebe9920931b3052e4129301` |
| Housing, migration, relocation, and displacement | #28 | `b0b67c54e98691c92f217fcc360b44f4d9cb1e4d` |
| Workplaces and Employment | #29 | `90ead5bd1145ff1497a92504fb4670d701b54be6` |
| Demand and Building Growth policy | #30 | `c7f5bc5a8ba7ec86dd9e7879f0dfd15fd85a5f58` |
| Atomic game integration, HUD, Save, and verification | #31 | `9409e301d2710db856b584fc555d5c4f714bba62` |

## Verification Corrections Applied

- Canonical Demand contribution ordering is independent of factor input order.
- Growth weights preserve relative positive Demand instead of saturating every open channel.
- Before the first Demand evaluation, all three zone channels use a deterministic bootstrap-open policy; persisted 15/5 hysteresis becomes authoritative immediately after the first evaluation.
- No-op Housing reconciliation and atomic Game World publication preserve snapshot identity.
- Strict optional-property typing is preserved for displacement expiry configuration.
- Browser Save/Load acceptance reads the current `WorldSaveV5` key and top-level schema while retaining each domain's nested schema version.

## Exact-Tree Verification Evidence

The complete foundation was verified on:

```text
Implementation head: 5f14c3c5797928a7b3874d137014b8d981620b5a
Tree:                75a04d244a3e27a7f6a89d46f90bd676d60626d4
Workflow run:        31111324705
Lean CI job:         92649574416 — PASS
Full browser job:    92649573982 — PASS
```

Observed results:

```text
RCI Core                             84 tests PASS
Game                                 197 tests PASS
Deployment                           16/16 PASS
Playwright browser acceptance        121 passed
Formatting / ESLint / TypeScript     PASS
Provenance                           469 source files PASS
Workspace builds                     PASS
Working tree                         clean
```

The final foundation commit `9409e301d2710db856b584fc555d5c4f714bba62` has the same tree SHA as the verified implementation head. The sequential squash merges therefore changed commit ancestry but not the verified source tree.

## Closure Gates

- [x] All implementation branches are formatted and type-safe.
- [x] All package and repository tests pass.
- [x] Deployment and build gates pass.
- [x] Full browser verification passes.
- [x] V1–V5 Save migration and continuous/resume equivalence pass.
- [x] 5,000-Citizen deterministic baseline passes.
- [x] No active-tool, pointer-session, or undo regression exists.
- [x] PR #26–#31 were merged sequentially.
- [x] Final foundation `master` tree is identical to the fully verified tree.
- [x] Living System Docs point to the final foundation baseline.

## Post-Closure Correction — Closed

Manual gameplay later exposed a fully-occupied R/C/I Growth deadlock. PR #32 corrected the target-buffer definitions and is documented in [the focused hotfix verification record](2026-08-06-rci-occupied-dwelling-demand-deadlock.md).

The original saved city recovered without reset or Save migration:

```text
Population 67 | Households 32 | Housing 32/34 | Employment 50/50
Buildings 37
Demand R +43 open | C +22 open | I +22 open
```

Final correction verification:

```text
Implementation head:       e33ef19c6eef4d593251d133913860a5416923e5
Tested PR merge ref:        5ab659bf63583a31c7442c865a1c0135e42ffc08
Tested source tree:         3c3daf8c7c50ed685116b6968c2df0f9e0e46322
Workflow run:               31147264885
Lean CI job:                92769224753 — PASS
Full browser job:           92769224712 — PASS
RCI Core:                   85/85 PASS
Game:                       197/197 PASS
Deployment:                 16/16 PASS
Playwright:                 121/121 PASS
Working tree:               clean
Browser artifact:           8982287711
Artifact SHA256:             90ac0af6d7918388b0131f422297885c87a7e992622182142381452042c9cc18
```

PR #32 was squash-merged as `03cf6a1d1702ec75d532e0f428b2044914156bba`. Its tree is `3c3daf8c7c50ed685116b6968c2df0f9e0e46322`, exactly matching the tested source tree. The correction is therefore part of the current runtime baseline with no unverified runtime delta introduced by squash merge.

## Documentation Authority

The original foundation closure evidence remains final. Current runtime and post-closure delivery status are maintained by [`../README.md`](../README.md); focused correction evidence is maintained by the linked hotfix record.
