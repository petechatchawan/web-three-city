# RCI PR 2 — Population Lifecycle Implementation Evidence

**Scope:** Population, Relationships, Households, Qualifications, and deterministic daily lifecycle  
**Branch:** `feat/rci-population-lifecycle-v0-1`  
**Verification status:** Implementation written; shared PR 2–6 verification intentionally deferred to the final integration stage

## Delivered

- Tick-derived age and canonical age-band boundaries.
- 08:00 daily lifecycle boundary detection.
- Disposable indexes for current Household membership, partner, and qualification state.
- Stable Household-membership and Relationship mutation planners.
- Canonical undirected partner pairs and directional biological-parent edges.
- Deterministic qualification resolution for working-age residents and immigrants.
- Counter-based FNV-1a sampling with locked UTF-8 golden vectors.
- Integer annual-rate to daily-hazard compilation.
- Ordered RCI domain events.
- Daily age transition, birth, death, Household dissolution, and historical-record preservation.
- Immutable RCI tick planning and stale-revision commit fences.
- Canonical historical Save regression and continuous versus encode/decode/resume coverage.

## Deferred Verification Policy

The owner requested that PR 2–6 implementation be completed before tests run. Therefore this record does not claim a final passing head. Exact commands, outputs, and final commit SHAs will be appended during PR 6 closure after the stacked integration branch is complete.

Final required gates:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/rci-core build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
pnpm verify:full
```

## Handoff Notes

- Population authority remains Citizen records, not aggregate counters.
- Household membership and family relationships remain independent normalized histories.
- Lifecycle decisions use the pre-mutation resident set in stable Citizen ID order.
- Generated IDs move only after a valid event is accepted.
- Housing, Employment, Demand, and app orchestration are deliberately owned by PR 3–6.
