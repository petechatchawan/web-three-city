# RCI PR 5 — Demand and Building Growth Policy Implementation Evidence

**Branch:** `feat/rci-demand-growth-v0-1`  
**Verification status:** Production, tests, and handoff documentation written; execution deferred to the final integration gate

## Delivered

- Extensible fixed-point R/C/I Demand factors and contribution records.
- Stable factor ordering and bounded raw targets.
- Integer smoothing into authoritative Demand state.
- Persisted `15_000/5_000` hysteresis gates.
- Derived RCI projection across Population, Housing, Migration, and Employment.
- Generic Building Growth policy contract and backward-compatible open policy.
- RCI policy factory mapping gates and Demand magnitude to zone eligibility/weight.
- Policy-aware deterministic Building placement across eligible zone origins.
- Tick integration after Population, Employment, Migration, and Housing reconciliation.

## Written Acceptance Coverage

- Factor-order permutation equality.
- Fixed-point bounds and smoothing vectors.
- Gate open/close/neutral-band retention.
- Policy channel gating and relative weights.
- Building default-policy compatibility and invalid-policy rejection.

## Deferred Verification Policy

Per owner instruction, PR 2–6 are completely written before tests run. Final package, repository, full-browser, Save/resume, and benchmark results are recorded in PR 6 closure evidence.

## Handoff Boundaries

- Smoothed Demand and Growth gates are authoritative and persisted.
- Raw factor contributions and policy objects are derived.
- Building Core owns only a generic caller policy contract and never imports RCI.
- Negative Demand suppresses future growth only; no abandonment exists in v0.1.
