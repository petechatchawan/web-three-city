# Architecture and Infrastructure Upgrade v0.1 — Final Closure

**Status:** `CLOSED / PASS`

**System:** `architecture-infrastructure`

**Closure date:** `2026-08-08`

**Authoritative scope:** Architecture and Infrastructure Upgrade v0.1 implementation and verification

## Verdict

Architecture and Infrastructure Upgrade v0.1 is `CLOSED / PASS`. PR5 was verified on one immutable candidate, squash-merged without a content change, and its candidate tree, CI-tested merge-ref tree, and merged runtime `master` tree are identical.

This document is the authoritative final milestone record. The [Phase 1 baseline](2026-08-07-architecture-infrastructure-phase-1-baseline.md) remains immutable historical evidence; its counts and timings are not restated as current measurements.

## Delivery Trace

| Slice                                          | Pull request                                                    | Merged commit                              | Result |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | ------ |
| PR1 — boundary/import/dependency enforcement   | [#37](https://github.com/petechatchawan/web-three-city/pull/37) | `7d58ad8ae1642d3d5b4b69ce667c5dbc1da2199a` | Merged |
| PR2 — committed-world application seam         | [#38](https://github.com/petechatchawan/web-three-city/pull/38) | `05334eba378340c610d6f6a8633e220a120580cf` | Merged |
| PR3 — dependent-world consistency              | [#39](https://github.com/petechatchawan/web-three-city/pull/39) | `6578b3fa13d19c608068995a1dd8796baf9d7ef7` | Merged |
| PR4 — bounded presentation coordination        | [#40](https://github.com/petechatchawan/web-three-city/pull/40) | `bbb49cc3e94d0de5808cf6a5fa0356ecf6dd4827` | Merged |
| PR5 — browser and CI verification architecture | [#42](https://github.com/petechatchawan/web-three-city/pull/42) | `48919fb3e49d894857b1e0cf23791cea43433b7b` | Merged |

## PR5 Merge Integrity

| Evidence                     | Value                                      |
| ---------------------------- | ------------------------------------------ |
| PR5 base                     | `bbb49cc3e94d0de5808cf6a5fa0356ecf6dd4827` |
| Verified candidate           | `3bc37181ef6506941e08f730bfb05a1c9776fc55` |
| Candidate tree               | `e6900f8068655055575802162e600e0e634f4ef4` |
| CI-tested GitHub merge ref   | `20ea0e33b8a0c3c365dd2f2c2bb9106a4f8255e6` |
| Merge-ref tree               | `e6900f8068655055575802162e600e0e634f4ef4` |
| Squash merge                 | `48919fb3e49d894857b1e0cf23791cea43433b7b` |
| Merged runtime `master` tree | `e6900f8068655055575802162e600e0e634f4ef4` |

The candidate and squash commits each have the PR4 commit as their single parent. Candidate tree == CI-tested merge-ref tree == merged runtime `master` tree: **PASS**.

## Final Verification Evidence

Final workflow: [CI #1136 / run `31257951025`](https://github.com/petechatchawan/web-three-city/actions/runs/31257951025), created `2026-08-08T12:45:04Z`, completed `2026-08-08T13:07:04Z`, exact source head `3bc37181ef6506941e08f730bfb05a1c9776fc55`.

### Lean CI

- Job [`93104176739`](https://github.com/petechatchawan/web-three-city/actions/runs/31257951025/job/93104176739): PASS, `12:45:20Z`–`12:47:13Z` (**1m53s**).
- `pnpm check`: `12:45:31Z`–`12:47:08Z` (**1m37s**); format, lint, typecheck, provenance, deployment/architecture contracts, unit suites, and build passed.
- Repository architecture/deployment contracts: **54/54 PASS**.
- RCI: **36 files / 88 tests PASS**.
- Game: **57 files / 230 tests PASS**, including `apps/game/test` discovery.
- `lean-builds` artifact: ID `9021959329`, 361,560 bytes, SHA-256 `a6afcfbe3fb194da186c9fda1aaec47a9107bbf4dd11f781db959970fb295e2b`.

### Full Browser Verification

- Job [`93104363552`](https://github.com/petechatchawan/web-three-city/actions/runs/31257951025/job/93104363552): PASS, `12:47:15Z`–`13:07:03Z` (**19m48s**).
- Browser step: `12:47:35Z`–`13:06:59Z` (**19m24s**); Playwright reported **118/118 PASS in 19.4m using 2 workers**.
- Inventory: **22 spec files / 118 tests** in one unfiltered Chromium release project; retries remain `0`.
- Ownership selection remains grep-compatible: `@smoke` 21 tests/4 files, `@road` 42/6, `@rci` 3/1, and `@release` 12/6. These subsets do not replace the unfiltered release authority.
- Browser downloaded artifact `lean-builds` from the same workflow run and restored `apps/game/dist` and `apps/terrain-lab/dist`.
- Browser executed dependency installation, artifact restore, Chromium installation, `pnpm test:browser:only`, and the clean-worktree check. It did not rerun `pnpm check`, unit tests, typecheck, or build.
- Post-browser clean-worktree gate: **PASS**.
- `browser-evidence` artifact: ID `9022163956`, 43,269,244 bytes, SHA-256 `cd62953421d492202681a98f79b8ea7464daa866069c81fbfda81e19a1cd458d`.

## Architecture and Topology Closure

- The production workspace graph is acyclic; undeclared workspace imports, package-to-app imports, core-to-presentation/app/browser imports, manifest drift, and core DOM ambient-library violations are rejected by repository-native contracts.
- Browser source-layout coupling moved from 65 direct imports in the Phase 1 scan to 13 exact reviewed edges: 11 in two named helpers, one Terrain Lab fixture-registry seam, and one declaration/bootstrap seam. The adversarial scanner rejects every unapproved edge; browser specs do not construct fixtures outside the allowlist.
- Test discovery moved from 47 Game source files / 197 tests plus 2 files / 7 tests excluded from normal verification to one enforced **57-file / 230-test** Game inventory.
- Browser ownership moved from untagged tests to filename tags with tested grep subsets, while the full Chromium inventory remains the release authority.
- Lean is the only verification/build owner in CI. Browser consumes the exact Lean outputs rather than repeating repository verification or preview builds.
- `game-bootstrap.ts` moved from 1,322 LOC / 34 imports at baseline to 1,260 LOC / 35 imports. The bounded application layer now contains committed-world fingerprint/store, transaction, Save, Undo, RCI reconciliation, and presentation coordination modules; this is responsibility extraction rather than a target LOC claim.

## Before/After Timing

| Measurement              |                                                              Phase 1 |                               Final | Interpretation                                                                        |
| ------------------------ | -------------------------------------------------------------------: | ----------------------------------: | ------------------------------------------------------------------------------------- |
| Local `pnpm verify:full` |                                  6:23.56; browser 121 passed in 5.7m | Not rerun for documentation closure | Historical local Node 24 evidence is not compared numerically with hosted CI Node 22  |
| Final Lean CI            | Browser formerly invoked `pnpm verify:full` and duplicated Lean work |           1m53s; `pnpm check` 1m37s | Lean owns repository verification/build once                                          |
| Final Browser CI         |    Repeated install, Lean verification, and builds before Playwright |     19m48s job; 118 passed in 19.4m | Hosted browser wall time is recorded; duplicated verification/build work is removed   |
| Final composed CI        |                                     No non-duplicating artifact path |             22m00s workflow elapsed | Lean-to-Browser dependency and artifact reuse preserve the composed Level 4 authority |

The local baseline and hosted final run use different machines, Node versions, inventories, and execution paths. They are evidence of their own environments, not a performance-regression or SLO comparison. The measured improvement is CI topology: verification and builds occur once and their exact outputs are reused.

## Non-Blocking Technical Debt

- `game-bootstrap.ts` remains the composition root with substantial concrete adapter/input wiring; only bounded responsibilities with characterized seams were extracted.
- The 2-worker deterministic browser suite remains long on hosted Chromium. Further parallelism or test partitioning requires new determinism and timing evidence rather than a global worker/retry/timeout increase.
- Thirteen direct browser source edges remain intentional reviewed seams. Any reduction should preserve deterministic fixture construction and must update the exact allowlist contract.
- The architecture scanner remains repository-native. Nx/Turborepo or another graph framework still requires a separate measured ADR.
- Sonar reported a passing quality gate and zero Security Hotspots for PR5, while its reported new-code issues remain outside this milestone's acceptance gate and may be triaged separately.

## Documentation-Only Verification Exception

This closure PR changes Markdown only under `docs/systems/architecture-infrastructure/**`. GitHub CI ignores `docs/**` and `**/*.md`; the runtime candidate already completed exact-head Lean and full-browser verification before its tree-identical merge. Repeating 118 browser tests would add no runtime evidence, so this PR uses the documentation-only exception: validate links, status/evidence consistency, whitespace, exact diff, path allowlist, one-commit history, and merged documentation presence. A browser rerun is required only if repository policy makes it a merge prerequisite.
