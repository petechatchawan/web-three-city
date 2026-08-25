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

Because this delivery closes PR #83 across an application-wide temporal boundary, record `pnpm verify`, `pnpm verify:full`, clean-worktree, and Sonar results at the exact pushed SHA.

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
