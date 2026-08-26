# PR #83 Clock Freeze Closure — Verification Contract

## Judgment states

- `NOT VERIFIED`: implementation or required evidence is incomplete.
- `AUTOMATED VERIFIED — OWNER VISUAL RETEST REQUIRED`: exact source passes all automated gates; manual 414×896 acceptance remains.
- `APPROVED`: human owner reports the required visual flow PASS and authorizes PR state change.

This repository file defines stable acceptance. Exact run IDs, artifact IDs, and post-push status belong in the PR body/comment so exact-head verification does not require a metadata-only commit.

## Source authority

Before verification, record in the PR evidence:

- branch and exact source-tested SHA;
- final documentation HEAD if later commits are docs-only;
- every commit between those SHAs, proving it is docs-only;
- remote exact HEAD after non-force push.

Tests from an older runtime SHA cannot be attributed to newer source.

## Required automated evidence

### Local Phase 1 implementation checkpoint

The initial local checkpoint recorded completion of the RED/GREEN loop for
the Phase 1 boundary fix. The final committed source candidate and closure
evidence are recorded below; the earlier checkpoint counts are retained here
as implementation-history context.

- Historical first-GREEN checkpoint: Game `98` files, `406/406` tests GREEN;
  Game typecheck GREEN.
- `simulation-core`: `5` files, `15/15` tests GREEN.
- `building-core`: `14` files, `36/36` tests GREEN.
- `building-three`: `3` files, `5/5` tests GREEN.
- Historical repository deployment/topology tests: `60/60` GREEN; inventory
  was `406` Game tests.
- `pnpm check`: GREEN, including format, lint, workspace typecheck, browser-test typecheck, provenance, deployment tests, all workspace tests, and build.
- Targeted Browser command used:
  `pnpm exec playwright test --project=chromium --workers=1 --retries=0 browser-tests/growth.@building.spec.ts browser-tests/growth-reservation.@building.spec.ts browser-tests/building.@building@smoke.spec.ts browser-tests/rci.@rci@smoke.spec.ts browser-tests/economy.@rci@interaction@smoke.spec.ts browser-tests/city-ui-dialogs.@rci@interaction.spec.ts browser-tests/game.@interaction@smoke.spec.ts browser-tests/water.@water.spec.ts browser-tests/zoning.@zoning.spec.ts browser-tests/citizen-mobility-traffic-save-load.@traffic@release.spec.ts browser-tests/citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts`
  completed `37/37` GREEN with one worker and no retries at the earlier
  checkpoint.

### Final Phase 1 source-tested closure

The final runtime/test source-tested SHA is
`2b2cab263ea658cf2c2b9310e5ff929230309e07`. The preceding production source
candidate was `d0d09620f8ae61481b32ce4c2a56aa77c7651f95`; the commits after it
are browser-test-only verification-budget adjustments and one documentation
reconciliation. They do not change production behavior, browser worker
topology, retries, or assertions.

- At `2b2cab263ea658cf2c2b9310e5ff929230309e07`, `pnpm check`: GREEN, including formatting, lint, workspace and browser
  typechecks, provenance, deployment/topology (`60/60`), all workspace tests,
  and application builds.
- At `2b2cab263ea658cf2c2b9310e5ff929230309e07`, Game: `98` files, `407/407` tests GREEN; Game typecheck GREEN.
- At `2b2cab263ea658cf2c2b9310e5ff929230309e07`, the serial targeted browser
  reproduction covering the Building smoke, Building visual, and Growth visual
  suites completed `5/5` GREEN with one worker and one retry budget.
- Full Browser: `149` tests, `148` passed, `1` skipped, `0` failed, using one
  clean local run at the preceding production source candidate. The skipped
  test is the explicit performance-authority
  test, gated to `WEB_THREE_CITY_PERFORMANCE_AUTHORITY=metal`; the default
  Chromium run used SwiftShader and therefore does not claim Metal release
  performance.
- Focused temporal/coordinator regression: `17/17` passed.
- Focused zoning visual regression: `1/1` passed.
- Focused Growth visual regression: `1/1` passed after preserving the
  validated static-authority cache across the five-phase batch.
- The final Full Browser run covered the affected browser boundary and
  completed with the Growth and zoning visual evidence tests GREEN.
- The final automated closure does not replace the human 414×896 Owner
  Visual checklist below; Owner Visual acceptance remains pending.

### Current local closure candidate

The current source-tested candidate is `9db33b5ef5ed37c80605467e7ac4a144dcd55a88`.
The documentation-only follow-up commit is intentionally separate from this
source-tested SHA.

- The reported manual freeze was reproduced as a stale local preview-server
  condition: an older Game preview process was already listening on port 4174.
  After stopping that repo-owned process and starting a fresh preview from the
  current build, the production playback regression passed.
- Game focused temporal/runtime/coordinator tests: `30/30` passed.
- New production-playback browser regression: `1/1` passed. It crosses
  `11:59 → 12:00` and `23:59 → 00:00` with Automatic Growth enabled, verifies
  continued time progression, Growth creation, and the committed-world
  revision invariant `delta = elapsed game minutes × 5`.
- Full Growth browser suite: `6/6` passed.
- Affected targeted Browser command
  `pnpm exec playwright test --grep '@building|@rci|@traffic|@interaction' --project=chromium --workers=1`:
  `74` passed, `1` skipped, `0` failed. The skipped case is the explicit
  Traffic performance-authority test gated to Metal; local Chromium uses
  SwiftShader.
- `pnpm verify`: GREEN. This included format, lint, workspace/browser
  typecheck, provenance, deployment contracts (`102/102`), all workspace
  tests (Game `407/407`), and builds.
- `pnpm verify:full`: clean install, verification, and Full Browser completed
  with `149/150` passed, `1` skipped, `0` failed. The final local clean-worktree
  check was blocked only by the two preserved user-owned untracked plan files;
  the browser-inventory contract change is committed in `9db33b5`.
- Local verification emitted the existing Node engine warning because the
  workstation uses Node `20.20.2` while the repository declares Node `>=22`;
  no test or build failure was attributed to that warning.

The exact-head targeted run `32885768470` passed Lean CI but failed one
Building visual evidence case after `138` browser tests because
`stepLogicalTicks` exceeded that suite's default `60s` budget in the serial
CI suite. The final source candidate raises only that visual suite budget to
`120s`; no worker, retry, assertion, or production behavior changed.

The final source candidate includes the narrow follow-up fixes required by
fresh verification: the deterministic zoning fixture avoids the fixed HUD,
temporal batch validation forks the existing validated static-authority cache
and marks each staged candidate so Q1–Q4 do not repeat map-wide static
validation, and the three long-running serial browser suites have scoped
timeouts calibrated from the exact-head CI timeout/flakiness evidence.

### Focused correctness

- Building lifecycle macro-hour API tests GREEN.
- Valid Growth `11:59 → 12:00` GREEN.
- Valid Growth `23:59 → 00:00` GREEN.
- No eligible lot remains a valid no-op.
- GameMinute plus Q1–Q4 returns five ordered receipts and revision `+5`.
- Injected rejection at each phase leaves minute/revision/world unchanged.
- Rejection pauses playback, clears accumulator, logs once, and does not retry.
- Dynamic cadence: five commits, one final flush, zero static sync, one notification.
- Growth cadence: five commits, one final flush, at most one static sync, one notification.

### Owner and consumer suites

Record command, total, passed, failed, skipped, and exact failure classification for simulation-core, building-core, building-three, rci-core, economy-core, citizen-mobility-core, traffic-core, and Game. New failures may not be called baseline merely because a historical count matches.

### Browser evidence

At 414×896 Chromium, record targeted `@building|@rci|@traffic|@interaction` results. Verify Zone placement, Automatic Growth, crossing both reported boundaries, x1/x2/x4 continuation, UI leaving `Applying change`, and rejection fail-stop behavior.

Because this delivery closes PR #83 across an application-wide temporal
boundary, record `pnpm verify`, `pnpm verify:full`, clean-worktree, and Sonar
results at the exact pushed SHA. The local final Full Browser equivalent is
recorded above; exact-head remote CI and Sonar remain post-push evidence.

## Owner Visual checklist

At 414×896 on the exact candidate:

1. Place a valid Zone and confirm `Applying change` clears.
2. Run x1 through `11:59 → 12:00`; confirm time and Growth continue.
3. Repeat at x2 and x4 across later hour boundaries.
4. Run through `23:59 → 00:00`; confirm time and Growth continue.
5. Confirm buildings start construction and progress rather than disappearing or remaining permanently incomplete.
6. Confirm Traffic remains separated and visible, turns/junctions behave correctly, and pause/resume works.
7. Confirm no recurring severe hitch and no new console error.

Only the human owner can mark this checklist PASS. Until then PR #83 remains Draft and unmerged.

## Final invariant statement

Success means one accepted minute advances `AbsoluteGameMinute +1` and world revision `+5`; rejection advances neither and publishes nothing. Automatic Growth remains enabled. Current calendar, pacing, and Save schema remain unchanged in this phase.
