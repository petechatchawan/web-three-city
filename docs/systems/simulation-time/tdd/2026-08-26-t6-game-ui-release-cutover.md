# T6 Game/UI + Release Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the application/UI cutover to the explicit temporal standard, remove remaining runtime compatibility seams, and close exact-head browser/CI/Sonar/owner release gates without altering product behavior beyond the approved compressed calendar.

**Architecture:** Game remains the cross-domain orchestrator. Domain packages own their temporal policies; Game composes them into one atomic temporal minute. UI consumes committed projections only. Release verification proves both deterministic authority and real browser behavior.

**Tech Stack:** TypeScript 6, Vitest 4, Three.js 0.185, Playwright 1.61, pnpm, GitHub Actions, Sonar.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- No second clock, no raw domain temporal arithmetic in UI/Game, no hidden compatibility state.
- Playback remains x1/x2/x4 = 1.000/0.500/0.250s nominal per GameMinute.
- Calendar is compressed 24h-cycle-as-month, 12 months/year.
- Successful minute is still exactly five authority revisions and one final external notification/presentation.
- Traffic physical/rendering behavior, Road authority, Growth policy, RCI demand policy, Economy monetary rules remain unchanged except approved temporal/calendar semantics.
- Owner Visual Acceptance is human-only and cannot be marked PASS by automation.

---

### Task 1: Eliminate remaining runtime temporal compatibility seams

**Files:**
- Search/modify: `apps/game/src/**/*.ts`
- Search/modify: `packages/*/src/**/*.ts`
- Modify architecture tooling only when a legitimate trusted codec path must be declared.

- [ ] **Step 1: Run inventory**:
```bash
rg "absoluteTick|bornAtTick|startedAtTick|endedAtTick|evaluationTick|construction.*Tick|scheduleCursorDay|arrivedAtGameSecond|Math\.floor\([^\n]*/\s*60|\*\s*4|as unknown as (AbsoluteGameMinute|MacroHourIndex|AbsoluteTransportSecond)" packages apps -g '*.ts'
```
Expected: only legacy codec/migration fixtures and intentionally historical type definitions may remain.
- [ ] **Step 2: Add architecture RED expectations** for any newly discovered production escape.
- [ ] **Step 3: Cut each runtime consumer to typed owner APIs**. Do not delete legacy codec fields still required to read V1–V8.
- [ ] **Step 4: Run `pnpm test:deployment` and `pnpm check`**.
- [ ] **Step 5: Commit** with `refactor(time): remove runtime temporal compatibility seams`.

### Task 2: Verify complete temporal-minute invariants end-to-end

**Files:**
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/simulation-runtime.test.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`

- [ ] **Step 1: Add/refresh the invariant matrix** for normal minute, Growth boundary, RCI/Economy 08:00 boundary, month rollover, year rollover, active Traffic, and a forced rejection in each phase.
- [ ] **Step 2: Assert successful case**: minute `+1`, revision `+5`, ordered receipts `GameMinute/Q1/Q2/Q3/Q4`, one final presentation, one committed-world notification.
- [ ] **Step 3: Assert rejected case**: original minute/revision/world unchanged, playback paused, accumulator cleared, one typed failure, no automatic retry.
- [ ] **Step 4: Run affected Game suite and full Game package tests**.
- [ ] **Step 5: Commit** with `test(game): verify temporal cutover invariants`.

### Task 3: Final time/calendar UI acceptance surface

**Files:**
- Modify: `apps/game/src/game-time-presentation.ts`
- Modify: `apps/game/src/ui/shell/simulation-controls.ts`
- Modify: `apps/game/src/ui/shell/game-hud.ts` or current time HUD owner if different.
- Test: `apps/game/src/game-time-presentation.test.ts`
- Test: `apps/game/src/ui/shell/simulation-controls.test.ts`
- Test: `apps/game/src/ui/shell/game-hud.test.ts`

**Interfaces:** UI displays clock + calendar month/year from projection, Pause/x1/x2/x4 state from runtime, and bounded typed failure status when temporal publication rejects.

- [ ] **Step 1: RED UI tests** for month/year rollover, speed selection, paused failure, explicit resume/step recovery, and no Day 1..30 legacy calendar label.
- [ ] **Step 2: Implement projection wiring only**; UI must not derive month/year with arithmetic.
- [ ] **Step 3: Run UI/Game GREEN**.
- [ ] **Step 4: Commit** with `feat(ui): complete temporal calendar cutover`.

### Task 4: Targeted browser verification

**Files:** existing relevant specs under `browser-tests/`.

- [ ] **Step 1: Build browser artifacts once**:
```bash
pnpm build:browser
```
- [ ] **Step 2: Run targeted Chromium** covering time/speed, Growth, RCI/Economy status surfaces, Save/load, Traffic continuity, interaction safety. Use existing tags and do not broaden to full browser merely because core packages changed.
- [ ] **Step 3: On any browser failure, debug at the lowest proving layer first**; do not patch around a browser-only symptom if owner/unit tests can reproduce it.
- [ ] **Step 4: Re-run targeted browser from a fresh built artifact after fixes**.

### Task 5: Repository release gates

- [ ] **Step 1: Run owner/affected package tests**:
```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
```
- [ ] **Step 2: Run repository gates**:
```bash
pnpm test:deployment
pnpm check
git diff --check
node tooling/verify-clean-worktree.mjs
```
- [ ] **Step 3: Review exact diff/stat, commit list, and unexplained changes**. No push if tracked worktree or provenance is not clean.
- [ ] **Step 4: Non-force push GREEN candidate** and wait for exact-head GitHub Actions + Sonar.
- [ ] **Step 5: Run `pnpm verify:full` only if repository release/shared-infra policy requires it for this final cutover**.

### Task 6: Owner 414x896 acceptance

Owner manually verifies on canonical mobile viewport:

- [ ] Clock increments correctly at Pause/x1/x2/x4.
- [ ] x4 is not slower than the merged baseline due to this migration.
- [ ] `23:59 -> 00:00` visibly advances one month.
- [ ] December rollover visibly advances one year.
- [ ] Growth/RCI/Economy/Mobility/Traffic continue through rollovers without freeze/retry loops.
- [ ] Save/load resumes the same city authority while using new calendar labels.
- [ ] Construction progress and citizen lifecycle do not visibly jump on migrated saves.
- [ ] Temporal failure UI pauses once and requires explicit recovery.
- [ ] Existing mobile controls/layout remain usable and no new full-screen clutter appears.

Automation may report RETEST REQUIRED but may not mark these human observations PASS.

## Exit Gate

The successor is release-complete only after exact-head CI, Sonar, required browser gates, clean-worktree evidence, and explicit Owner Visual Acceptance. T7 cleanup may then remove compatibility code that is no longer needed for historical Save readers; it must not delete V1–V8 read support.