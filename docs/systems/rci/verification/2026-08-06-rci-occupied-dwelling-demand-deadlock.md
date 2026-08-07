# Verification — RCI Fully-Occupied Growth Deadlock

**Status:** Closed — manual and automated acceptance PASS; merged to `master`  
**Reported:** 2026-08-06  
**Manual acceptance completed:** 2026-08-07  
**Automated acceptance completed:** 2026-08-07  
**Scope:** RCI Demand & Occupancy Foundation v0.1 post-closure correction  
**Pull request:** #32  
**Final implementation head:** `e33ef19c6eef4d593251d133913860a5416923e5`  
**Squash-merge commit:** `03cf6a1d1702ec75d532e0f428b2044914156bba`

## Symptom

A small city reached a stable but non-progressing state:

```text
Population 4
Households 3
Housing 3/3
Employment 4/4
Demand R -32 closed | C -29 closed | I -47 closed
```

All three Growth gates were closed. Residential Growth could not create another Dwelling Unit, Commercial and Industrial Growth could not create another Workplace, and migration could not change the state because every Dwelling Unit and every position was occupied.

## Root Causes

### Residential authority mismatch

The original `demand.residential.target-buffer` measured housing supply as:

```text
residentCapacity - residentCount
```

That value represents spare resident capacity inside existing homes. It does not represent a Dwelling Unit that another Household can occupy. Housing reconciliation and incoming materialization correctly require a wholly vacant Dwelling Unit, so Demand and migration used incompatible definitions of available housing.

### Commercial and Industrial unreachable gates

The original Workplace target-buffer factors produced `+20,000` at full occupancy and then applied a `700/1_000` weight. With no unemployed residents, each raw channel could reach only:

```text
20,000 × 700 / 1,000 = 14,000
```

The persisted Growth gate requires `15,000` to open. A fully occupied Commercial or Industrial channel therefore could not reopen by itself.

## Corrected Contract

- Residential Demand targets a 10% wholly vacant-Dwelling buffer, with a minimum target of one vacant Dwelling Unit.
- Commercial and Industrial Demand target a 20% vacant-position buffer, with a minimum target of one vacant position.
- Incoming-queue, displacement, and labor-shortage contributions are unchanged.
- Fixed-point smoothing, hysteresis thresholds, stable ordering, and persisted Demand state are unchanged.
- `RciSaveV1` and `WorldSaveV5` are unchanged.
- Existing saves recover through derived Demand reevaluation; no migration or world reset is required.

## TDD Regression

The regression reproduces the reported state with:

```text
residentCount = 4
householdCount = 3
residentCapacity = 12
vacantDwellingCount = 0
workingAgeResidentCount = 4
employedResidentCount = 4
commercialPositionCapacity = 2
commercialVacantPositionCount = 0
industrialPositionCapacity = 2
industrialVacantPositionCount = 0
previous Demand = R -32,000 | C -29,000 | I -47,000
all Growth gates = closed
```

RED evidence:

```text
Residential expected target-buffer:            +100,000
Residential previous result:                   -100,000
Commercial/Industrial previous factor result:   +20,000
Commercial/Industrial previous weighted raw:    +14,000
Growth gate opening threshold:                  +15,000
```

The final regression requires all three Demand channels to recover to at least `15,000`, all three Growth gates to reopen within three daily evaluations, and the authoritative evaluation tick to reach the final boundary.

## Manual Recovery Evidence

The original saved city was loaded on the complete correction and continued at `4×` without resetting the world or migrating the save.

First observed recovery:

```text
Year 1 / Month 3 / Day 9 / 10:00
Population 47
Households 23
Housing 23/24
Employment 37/37
Buildings 27
Demand R +20 open | C +34 open | I -83 closed
```

Residential and Commercial recovered first. Continued simulation then produced:

```text
Year 1 / Month 4 / Day 4 / 06:00
Population 67
Households 32
Housing 32/34
Employment 50/50
Buildings 37
Zones R 40 | C 6 | I 4
Demand R +43 open | C +22 open | I +22 open
```

### Manual verdict: PASS

- Population increased from `4` to `67`.
- Households increased from `3` to `32`.
- Active Buildings increased to `37` through automatic Growth.
- Residential, Commercial, and Industrial Demand all recovered above the opening threshold.
- All three persisted Growth gates reopened.
- Industrial recovery occurred naturally after workforce and capacity changed; it was not forced through a reset or direct Develop action.
- The original all-closed deadlock is no longer reproducible.
- Save compatibility is confirmed at the gameplay level because the original saved city resumed directly.

## Final Exact-Head Automated Verification

The final implementation was verified through the PR merge ref generated from exact head `e33ef19c6eef4d593251d133913860a5416923e5` and foundation base `9409e301d2710db856b584fc555d5c4f714bba62`.

```text
Implementation head:       e33ef19c6eef4d593251d133913860a5416923e5
Tested PR merge ref:        5ab659bf63583a31c7442c865a1c0135e42ffc08
Tested source tree:         3c3daf8c7c50ed685116b6968c2df0f9e0e46322
Workflow run:               31147264885
Lean CI job:                92769224753 — PASS
Full browser job:           92769224712 — PASS
```

Lean/full verification evidence:

```text
Prettier                               PASS
ESLint                                 PASS
TypeScript workspace + browser         PASS
Provenance                             469 source files PASS
RCI Core                               35 files / 85 tests PASS
Game                                   47 files / 197 tests PASS
Deployment                             16/16 PASS
Workspace builds                       PASS
Playwright browser acceptance          121/121 PASS (16.4m)
Working tree                           clean
```

Browser evidence artifact:

```text
Artifact ID:      8982287711
Artifact name:    browser-evidence
Artifact size:    42,601,669 bytes
SHA256:           90ac0af6d7918388b0131f422297885c87a7e992622182142381452042c9cc18
```

### Visual fixture correction

The pre-fix visual acceptance expected four Buildings at logical tick 48. The corrected Demand model legitimately allows additional deterministic Growth before that boundary. Diagnostic evidence established the new exact fixture contract, then all diagnostics were removed before final verification:

```text
absoluteTick:              48
growthSequence:            7
buildingCount:             7
committedBuildingRevision: 7
buildingCommitCount:       7
occupiedCellCount:         9

definitionIds:
- commercial-cafe-1x1
- commercial-cafe-1x1
- commercial-shop-1x1
- industrial-depot-1x1
- industrial-depot-1x1
- industrial-workshop-1x2
- residential-duplex-2x1
```

The browser acceptance was updated to assert this exact deterministic outcome rather than weakening the assertion. The final `121/121` run includes this corrected fixture.

## Merge and Tree Equality

PR #32 was squash-merged to `master` as:

```text
Merge commit:       03cf6a1d1702ec75d532e0f428b2044914156bba
Merge tree:         3c3daf8c7c50ed685116b6968c2df0f9e0e46322
Tested source tree: 3c3daf8c7c50ed685116b6968c2df0f9e0e46322
```

The squash-merged runtime tree is exactly the tree exercised by the passing CI run. The merge therefore introduced no unverified runtime delta.

## CI Infrastructure Note

Earlier GitHub Actions runs during the incident window were cancelled or skipped before execution while hosted runners were unavailable. For example, run `31122086766` ended with Lean CI cancelled and Full browser verification skipped. Those runs provide no code verdict and are superseded by successful final run `31147264885`.

## Documentation Normalization

The correction is reflected in the complete RCI handoff set:

- [`../README.md`](../README.md) — current runtime behavior, delivery state, and documentation precedence.
- [`../specs/README.md`](../specs/README.md) — implemented specification status and post-closure clarification.
- [`../tdd/README.md`](../tdd/README.md) — completed execution packet and retained binding contracts.
- [`2026-08-06-rci-foundation-v0-1-closure.md`](2026-08-06-rci-foundation-v0-1-closure.md) — final foundation baseline and closed post-closure correction boundary.

The original design specification remains a planning-time historical record. Current status is maintained by the living System README and verification records.

## Closure Verdict

**PASS — closed.** The fully-occupied R/C/I Growth deadlock is fixed, the original save recovers without migration, exact-head Lean and Full browser verification pass, all `121` browser scenarios pass, and the squash-merged `master` runtime tree is identical to the tested source tree.
