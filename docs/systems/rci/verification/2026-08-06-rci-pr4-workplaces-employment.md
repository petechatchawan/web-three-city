# RCI PR 4 — Workplaces and Employment Implementation Evidence

**Branch:** `feat/rci-employment-v0-1`  
**Verification status:** Production, acceptance tests, and handoff documentation written; execution deferred to final stacked verification

## Delivered

- Deterministic Workplace inventory synchronized from active Commercial/Industrial Buildings.
- Versioned position-group capacities and qualification requirements.
- Historical Workplace retirement and assignment ending.
- Derived Employment projection and current-state indexes.
- Stability-first reconciliation that preserves valid assignments.
- Closest-qualified matching for unemployed Working-Age residents.
- Stable tie-breaking by Citizen, Workplace, and position-group IDs.
- Capacity enforcement and no displacement of valid workers.
- At most one vacant better-fit controlled upgrade per daily boundary.
- Compatible vacancy supply passed to incoming migration policy.
- Employment-side fixed-point emigration pressure factors.

## Written Acceptance Coverage

- Workplace activation/retirement from Building lifecycle.
- Exact/closest qualification matching.
- Assignment stability and capacity bounds.
- Input permutation determinism.
- Employment projections and pressure-factor ordering.

## Deferred Verification Policy

Per owner instruction, PR 2–6 are fully written before tests execute. This record does not yet claim a passing exact head. Final package/repository/full-browser commands, outputs, and commit SHAs will be appended during PR 6 closure.

## Handoff Boundaries

- Building owns lifecycle and capacity-profile references; RCI owns Workplace inventory and Employment history.
- Reconciliation never displaces a valid worker.
- Unemployed matching precedes controlled upgrades.
- Controlled upgrade requires an already-vacant better-fit position and is capped at one per day.
- Economy wages, profitability, and household income remain outside this milestone.
