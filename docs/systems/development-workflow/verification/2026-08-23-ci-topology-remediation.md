# CI Topology Remediation — Verification Handoff

**Status:** Automated implementation gate complete; Owner Acceptance pending
**System:** `development-workflow`
**Scope:** CI-R1–CI-R6 execution topology and measurement evidence

## Authority and execution contract

`AGENTS.md` Level 0–4 remains the only verification-level authority:

- Level 0: focused local iteration;
- Level 1: owning package;
- Level 2: affected consumers;
- Level 3: repository/tooling verification;
- Level 4: Full Browser/full regression escalation.

`GRAPH_SAFE`, `PARTIAL`, `GRAPH_BLIND`, and `GLOBAL` are resolver risk signals,
not a second verification hierarchy.

Normal pull-request execution is:

```text
changed files
  → affected-verification-plan.json
  → owner/related tests + consumers + typechecks + deployment lanes
  → browser_build when Browser authority is required
  → targeted Browser from the exact affected plan
```

Browser consumes the exact Game/Terrain Lab artifact produced by
`browser_build`; it does not wait for or consume Lean artifacts. Lean is the
aggregate of the independent non-browser lanes. Full Browser remains an
explicit Level-4 escalation/backstop. `pnpm verify:full` remains the serial
local/manual rollback authority.

## Full Browser correctness baseline

The serial Chromium inventory is **137 tests across 33 spec files**. The
two-shard pilot preserves that exact authority:

| Shard | Tests | Workers |
| --- | ---: | ---: |
| 1/2 | 71 | 1 |
| 2/2 | 66 | 1 |
| Exact union | 137 | no overlap, no missing, no extra |

No assertions, retries, workers, or timeouts were weakened to obtain this
split. This PR does not expand beyond two shards.

## CI-R5 measurement evidence

The hosted baseline measurement was collected on candidate
`67fa70283c63bb719378712a2ecfff11792aaea3`, run `32641871744`. The final
closure candidate and its exact-head run are maintained in the PR body after
the documentation correction; this record intentionally keeps the measured
contract stable instead of accumulating mutable run IDs in living docs.

Observed wall-clock result:

- workflow wall clock: approximately **14m22s**;
- Full Browser shard 1/2: **13m46s**;
- Full Browser shard 2/2: **12m31s**;
- limiting lane: **Full Browser shard 1/2**;
- target: **8–12 minutes**;
- target status: **NOT YET MET**;
- correctness/coverage status: **PASS**.

Wall-clock time is not runner consumption. Summing hosted job elapsed times
from start/completion timestamps gives approximately **28.5 runner-minutes**
(1,711 elapsed runner-seconds before any platform billing-minute rounding):

| Lane/job | Elapsed |
| --- | ---: |
| Classify affected verification | 9s |
| Changed-file lint | 18s |
| Related owner tests | 14s |
| Affected consumer tests | 15s |
| Affected typecheck | 12s |
| Deployment contracts | 44s |
| Browser build artifact | 17s |
| Lean aggregate | 5s |
| Full Browser shard 1/2 | 826s |
| Full Browser shard 2/2 | 751s |
| **Total elapsed runner time** | **1,711s ≈ 28.5m** |

The 8–12 minute target is therefore a follow-up optimization candidate, not
a correctness blocker. This phase does not change coverage, worker count,
retry policy, or timeout policy to chase the target.

## Natural canary status

The current hosted run is a valid **shared/global** canary because PR #92
changes CI/shared verification topology and legitimately escalates to Full
Browser. It proves the full-mode artifact handoff, two-shard union, and
parallel execution path.

No valid post-topology natural **deterministic-only** canary is available yet.
No valid post-topology natural **browser-observable targeted** canary is
available yet. Earlier PR-T4/PR-T5 runs predate this topology and are not
represented as evidence for it. Status for both canaries is:

```text
measurement pending first natural post-topology candidate
```

No artificial production or test commit is created solely to manufacture
these measurements. The missing canaries characterize future performance;
they do not invalidate the implementation gate when the locked plan permits
natural-candidate evidence to remain pending.

## Verification and rollback

The exact-head candidate must report, in the PR body:

- affected plan and independent non-browser lanes;
- `pnpm verify` and deployment contract result;
- Browser build artifact and Browser mode;
- Full Browser shard counts/union when escalation applies;
- Sonar Quality Gate;
- clean-worktree evidence;
- current wall-clock and runner-minute measurements.

Rollback remains:

```text
classification uncertainty
  → full-ci
  → full deterministic + Full Browser

topology regression
  → revert the topology change
  → retain pnpm verify:full serial authority
```

The PR remains Draft until Owner Acceptance. RCI, Growth, Zoning, Building,
Water, Terrain, and other deterministic migration work remains stopped in
this closure.
