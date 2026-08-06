# Verification — Occupied-Dwelling Demand Deadlock

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

All three Growth gates were closed. Residential Growth could not create another Dwelling Unit, while incoming Household materialization could not proceed because every Dwelling Unit already had an active Household assignment.

## Root Cause

`demand.residential.target-buffer` measured housing supply as:

```text
residentCapacity - residentCount
```

That value represents unused resident capacity inside existing homes. It does not represent a Dwelling Unit that another Household can occupy. Housing reconciliation and incoming materialization correctly require a wholly vacant Dwelling Unit, so Demand and migration used incompatible definitions of available housing.

## TDD Evidence

The regression was written before the production change and reproduces the reported state with:

```text
residentCount = 4
householdCount = 3
residentCapacity = 12
vacantDwellingCount = 0
previous Residential Demand = -32,000
Residential Growth gate = closed
```

RED evidence:

```text
expected Residential target-buffer contribution: +100,000
actual previous formula contribution:          -100,000
```

The regression requires Residential Demand to recover to the `15,000` opening threshold and reopen its Growth gate within three daily Demand evaluations.

## Fix

- Add active `householdCount` to the derived Demand context.
- Define the Residential target as a 10% wholly vacant-Dwelling buffer, with a minimum target of one vacant Dwelling Unit.
- Preserve incoming-queue and displacement contributions.
- Preserve fixed-point smoothing, hysteresis thresholds, stable ordering, persisted Demand state, and `WorldSaveV5` schema.
- Existing saves need no migration because the corrected input is a derived projection rebuilt on the next daily evaluation.

## Exact-Head Lean Verification

Exact branch head before documentation-only follow-up:

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

The RCI count increased from 84 to 85 tests through the new gameplay-state regression.

## Final Verification

The final PR head must pass both Lean CI and Full browser verification after this documentation is committed. Record the exact run, head, browser count, clean-worktree result, merge commit, and final `master` tree equality in the PR before closure.
