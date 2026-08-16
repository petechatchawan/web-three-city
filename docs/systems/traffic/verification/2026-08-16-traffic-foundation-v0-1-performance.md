# Traffic Foundation v0.1 — PR11 Browser Performance Evidence

Status: **PENDING EXECUTION**

This record is intentionally created before the PR11 verification phase because the implementation workflow writes the complete production/test packet first and executes tests afterward. No PASS, timing, memory, CI, or release claim is recorded here until the exact-head verification run exists.

## Deterministic workload

- Browser acceptance: `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`
- Canonical viewport: 414×896 portrait
- Logical Citizens: 5,000 real RCI Citizen IDs in the browser performance fixture
- Logical active Traffic trips: 5,000, mixed Walk/Drive
- Road graph: deterministic distributed grid across the committed world
- Presentation policy gates:
  - visible pedestrians <= 300
  - visible vehicles <= 300
  - full-detail Near agents <= 500
  - spatial candidate count < total logical trips
  - visited spatial buckets < total spatial buckets
  - camera leave/return increases pool reuse

The browser performance fixture is release/debug evidence only. Canonical Traffic and Citizen authority remain the committed snapshots; presentation caps, LOD, spatial indexing, pooling, and measured frame timing are derived concerns.

## Measurements to record after execution

The browser test captures three same-environment frame-duration samples and attaches `traffic-performance-measurements.json` containing:

- Playwright project/browser
- viewport
- logical Citizen/trip counts
- Traffic presentation debug counters
- median/min/max/spread for each sample run
- median of run medians
- JS heap observation when the browser exposes `performance.memory`

Timing remains observational unless repeated CI evidence proves a stable failure threshold. Deterministic workload/cap/spatial-work assertions remain the release gate.

## Exact-head evidence

- Candidate SHA: **PENDING**
- Focused browser result: **PENDING**
- Full Chromium inventory/result: **PENDING**
- CI run: **PENDING**
- Browser evidence artifact ID/digest: **PENDING**
- Sonar/quality result on same SHA: **PENDING**
- Measurement run 1: **PENDING**
- Measurement run 2: **PENDING**
- Measurement run 3: **PENDING**
- Median/spread: **PENDING**
- Memory observation: **PENDING**

## Manual visual acceptance

Owner visual acceptance at 414×896 remains a separate mandatory PR11 gate and is **PENDING**. Automated performance evidence does not substitute for visual acceptance of real pedestrians, cars, queues, Inspect, Traffic overlay, or peak-flow readability.
