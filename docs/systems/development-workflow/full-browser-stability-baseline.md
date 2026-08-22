# Full Browser Stability Baseline

**Status:** Stability backlog — evidence recorded, remediation not included
**Date:** 2026-08-22
**Scope:** Full Chromium release authority only

## Purpose

This document separates pre-existing Full Browser instability from the
authority-aware verification resolver and from Road/Traffic migration work.
It is evidence for focused stabilization tasks; it is not permission to
weaken assertions, increase retries, expand workers, or inflate timeouts.

## Exact baseline from PR #87

| Field | Evidence |
|---|---|
| Candidate SHA | `8697488c7c6ca3d9f8ee6ca281a3890324685158` |
| Workflow run | `32557522734` |
| Browser job | `96994184806` |
| Browser artifact | `9472266551` |
| Result | `CANCELLED` by the 35m18s job timeout |
| Lean job | `96993963362` — PASS |
| Trigger | explicit `full-ci` escalation |
| Traffic observation | early Traffic coverage passed before unrelated groups ran |

The run did not complete the 137-test Chromium inventory. The observed
failure groups were:

- Economy / RCI
- Game UI
- Growth
- Water
- Zoning

These groups are not evidence of a Traffic migration defect. Each group needs
its own reproduction at a known exact head and an authority classification:
product defect, test defect, environment flake, or timeout-budget issue.

## Fresh exact-head escalation from PR #88

The explicit shared-verification escalation for PR-T3.3 was also run against
the final resolver candidate:

| Field | Evidence |
|---|---|
| Candidate SHA | `c928e9044947727a62ea64ca24dd9114a11d871c` |
| Workflow run | `32576690764` |
| Browser job | `97040314452` |
| Browser artifact | `9477187019` (`browser-evidence`) |
| Result | `CANCELLED` by the 35m21s job timeout |
| Lean job | `97039957022` — PASS |
| Sonar | PASS |
| Traffic observation | Traffic evidence ran before the unrelated failure groups; no resolver-related browser failure was observed |

Distinct failure evidence captured before timeout:

- RCI HUD round-trip values; Economy committed-save round trip;
- RCI/game dialog active-tool expectations;
- Game WorldSave round trip and interaction tool selection;
- Growth deterministic time controls, construction-per-tick, mobile controls,
  automatic tool/in-progress stroke, exact logical tick persistence, and
  reservation behavior;
- Building Undo/SaveV7 and Residential/Industrial visual prototypes.

The artifact contains screenshots, traces, and `error-context.md` for these
cases. Road visual evidence completed in the same run, and the run did not
produce a Traffic authority failure before the timeout.

## Local package-suite timing observation

At resolver candidate `c928e9044947727a62ea64ca24dd9114a11d871c`, a recursive
`pnpm verify` run reached the existing Game suite and intermittently timed out
the following test at its unchanged 5-second Vitest limit:

```text
apps/game/src/mobility-traffic-save-continuation.test.ts
Mobility/Traffic WorldSaveV8 continuation
matches continuous morning+return commute after a midday save/decode boundary
```

The focused test passed in about 1.1s, and a standalone Game package run
passed `93` files / `376` tests. A separate full recursive run also passed
the same Game inventory. This is currently classified as a reproducibility
and resource-contention investigation item, not a timeout to be hidden.

## Stabilization protocol

For each group:

1. Reproduce the exact test/spec at the same project and viewport.
2. Capture the first failing assertion and complete trace.
3. Determine whether the failure is product, test, environment, or budget.
4. Add a focused RED reproduction when a code/test fix is justified.
5. Apply the smallest owning fix and prove GREEN.
6. Run the affected browser subset, Lean, Sonar, and the required Full Browser escalation.

Do not change Playwright workers, retries, global timeouts, or assertions as a
stability workaround.

## Relationship to verification architecture

Normal PRs continue to use owner tests, Level-2 consumers, and targeted
browser authority. Full Browser remains an explicit release/shared-infra
escalation. This backlog must not be used to restore Full Browser as the
default gate or to make resolver risk semantics less conservative.
