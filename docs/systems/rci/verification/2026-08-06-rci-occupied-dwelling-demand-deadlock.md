# Verification — RCI Fully-Occupied Growth Deadlock

**Date:** 2026-08-06  
**Scope:** RCI Demand & Occupancy Foundation v0.1 hotfix  
**PR:** #32  
**Reported through:** Manual gameplay verification

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

`demand.residential.target-buffer` measured housing supply as:

```text
residentCapacity - residentCount
```

That value represents unused resident capacity inside existing homes. It does not represent a Dwelling Unit that another Household can occupy. Housing reconciliation and incoming materialization correctly require a wholly vacant Dwelling Unit, so Demand and migration used incompatible definitions of available housing.

### Commercial and Industrial unreachable gates

The Workplace target-buffer factors subtracted the vacancy ratio directly from `20,000`, then applied a `700/1,000` factor weight. With every position occupied and no unemployed residents, each raw channel could reach only:

```text
20,000 × 700 / 1,000 = 14,000
```

The persisted Growth gate requires `15,000` to open. Therefore a fully occupied Commercial or Industrial channel could never reopen without an external state change, while that external state change itself required new housing and jobs.

## TDD Evidence

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

First RED evidence:

```text
expected Residential target-buffer contribution: +100,000
actual previous formula contribution:          -100,000
```

Expanded RED contract:

```text
expected each fully-occupied target-buffer contribution: +100,000
previous Commercial/Industrial contribution:              +20,000
previous weighted raw Commercial/Industrial Demand:       +14,000
Growth gate opening threshold:                             +15,000
```

The final regression requires Residential, Commercial, and Industrial Demand to each recover to the `15,000` opening threshold and reopen all three Growth gates within three daily Demand evaluations.

## Fix Contract

- Add active `householdCount` to the derived Demand context.
- Define the Residential target as a 10% wholly vacant-Dwelling buffer, with a minimum target of one vacant Dwelling Unit.
- Normalize Commercial and Industrial target-buffer pressure relative to a 20% vacant-position target, with a minimum target of one vacant position.
- Preserve incoming-queue, displacement, and labor-shortage contributions.
- Preserve fixed-point smoothing, hysteresis thresholds, stable ordering, persisted Demand state, and `WorldSaveV5` schema.
- Existing saves need no migration because the corrected inputs are derived projections rebuilt on the next daily evaluation.

## Intermediate Lean Verification

Exact branch head after the Residential authority correction:

```text
df79df073ffda741752f736f592ef83f22641bc7
```

GitHub Actions:

```text
Run: 31120384592
Lean CI job: 92679748395
Result: PASS
```

Evidence:

```text
Prettier                                     PASS
ESLint                                       PASS
TypeScript workspace + browser               PASS
Provenance                                   469 source files PASS
RCI Core                                     35 files / 85 tests PASS
Game                                         47 files / 197 tests PASS
Deployment                                   16/16 PASS
Workspace builds                             PASS
```

## Manual Recovery Verification

The original saved city was loaded on the complete R/C/I correction and continued at `4×` without resetting the world or migrating the save.

Intermediate observed state:

```text
Year 1 / Month 3 / Day 9 / 10:00
Population 47
Households 23
Housing 23/24
Employment 37/37
Buildings 27
Demand R +20 open | C +34 open | I -83 closed
```

The Residential and Commercial channels recovered first. Continued simulation then produced:

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

Manual verdict:

- Population increased from `4` to `67`.
- Households increased from `3` to `32`.
- Active Buildings increased to `37` through automatic Growth.
- Residential, Commercial, and Industrial Demand all recovered above the opening threshold.
- All three persisted Growth gates reopened.
- Industrial recovery occurred after the workforce and capacity state changed naturally; it was not forced through a reset or direct player development action.
- The reported all-closed RCI deadlock is no longer reproducible on the corrected branch.

## Final Verification

The final PR head must pass both Lean CI and Full browser verification after this manual evidence commit. Record the exact run, head, browser count, clean-worktree result, merge commit, and final `master` tree equality in the PR before closure.
