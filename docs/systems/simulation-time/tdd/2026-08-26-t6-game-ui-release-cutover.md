# T6 Game/UI + Temporal Release Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete product-level Game/UI wiring for the approved compressed calendar and WorldSaveV9, prove the entire temporal program in deterministic and browser authority layers, and close exact-head CI/Sonar/Owner acceptance without introducing new simulation behavior.

**Architecture:** T1–T5 own the temporal model, domain migrations, calendar projection, and persistence. T6 is a release cutover: Game composes those already-proven authorities, UI renders committed projections only, and Browser/Owner gates validate real interaction and presentation. Broad legacy-name cleanup is intentionally deferred to T7 unless a remaining seam is actively used by the T6 runtime path.

**Tech Stack:** TypeScript 6, Vitest 4, Three.js 0.185, Playwright 1.61, pnpm, GitHub Actions, SonarQube Cloud.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Prerequisites and Branch Rule

- T5 WorldSaveV9 must be merged and exact-head GREEN.
- Create `feat/t6-temporal-release-cutover` from the then-current `master`.
- Record `T6_BASE_SHA=$(git rev-parse HEAD)` before the first RED.
- Do not begin T7 broad cleanup inside T6. Only remove a compatibility seam in T6 if it is on the active product path and blocks correct release behavior.

## Current-Source Audit to Reconfirm Before RED

At planning time, before T3–T5 execution:

- `apps/game/src/ui/shell/simulation-controls.ts` and `.test.ts` own Pause/x1/x2/x4/Step control presentation.
- `apps/game/src/ui/shell/game-hud.ts` and `.test.ts` own the HUD surface that includes simulation time information.
- `apps/game/src/ui/shell/player-shell.ts` / `player-shell-wiring.test.ts` compose shell-level projections/actions.
- `apps/game/src/ui/shell/status-feedback.ts` owns bounded user-facing status/error feedback.
- `apps/game/src/game-time-presentation.ts` is the application projection seam for calendar/time labels and should already use T4 canonical Y/M/HH:MM projection by T6.
- Browser suites already include Traffic commute/save-load/mobile/release coverage, city UI responsive/mobile release coverage, Building release coverage, and simulation inspection coverage.
- T5 should make WorldSaveV9 canonical while retaining V1–V9 reads.

Reconfirm the post-T5 paths before editing:

```bash
rg "gameTime|calendar|month|year|day|Pause|Step|speed|WorldSaveV9|schemaVersion|temporal failure|publication" \
  apps/game/src/ui apps/game/src browser-tests -g '*.ts'
```

If T4/T5 already completed a wiring step, keep it as test-only release evidence instead of rewriting it.

## Global Constraints

- No second mutable clock and no UI-owned calendar arithmetic.
- Calendar remains exactly `60 GameMinutes/hour`, `24 hours = 1 Simulation Cycle = 1 Calendar Month`, `12 months/year`.
- Playback remains x1/x2/x4 = `1.000 / 0.500 / 0.250 seconds` per GameMinute.
- Successful automatic minute remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, revision `+5`, one final presentation, one external committed-world notification.
- Rejection remains fail-stop and atomic: no minute/revision/world mutation, playback pauses, wall-clock accumulator clears, one typed failure, no silent retry.
- WorldSaveV9 is canonical writer; V1–V9 readers remain available.
- Building construction/Growth, RCI age/hazard/demand, Economy formulas/settlement, Mobility schedules, Traffic quanta/physics/routing, and Road authority remain unchanged beyond already-approved temporal semantics.
- Automatic Growth remains ON.
- No new speed tuning, calendar mechanics, seasons, offline catch-up, Economy month/year mechanics, Traffic presentation rewrite, or UI redesign.
- Canonical mobile Owner Visual viewport is `414×896`.
- Owner Visual Acceptance is human authority only; automation may prepare evidence but may not mark it PASS.

---

### Task 1: Freeze the Full Release Invariant Matrix

**Files:**
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/simulation-runtime.test.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`
- Test: `apps/game/src/economy-save-continuation.test.ts`
- Test: existing Building/RCI continuation tests.

**Interfaces:** The release matrix covers normal minute, 08:00 domain boundary, month rollover, year rollover, active construction, Mobility/Traffic, save/load, and forced rejection at each temporal phase.

- [ ] **Step 1: Add/refresh a normal-minute case** asserting canonical minute `+1`, five ordered authority publications, final revision `+5`, one presentation refresh, one external world notification.
- [ ] **Step 2: Add/refresh an 08:00 case** proving Building/RCI/Economy cadence executes once according to owner rules with no duplicate settlement/lifecycle event.
- [ ] **Step 3: Add `23:59 -> 00:00` month rollover and M12->Y+1 rollover** with active Mobility and Traffic.
- [ ] **Step 4: Add a post-V9 save/load continuation case** combining construction-in-progress, RCI citizen near age boundary, Economy history, active Walk, active Drive, and queued Traffic.
- [ ] **Step 5: Add forced rejection coverage for GameMinute and each Q1–Q4 phase**. Assert original canonical minute/revision/world unchanged, runtime paused, accumulator cleared, one typed failure, no automatic retry.
- [ ] **Step 6: Run focused + full Game GREEN**:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/temporal-publication.test.ts \
  src/simulation-runtime.test.ts \
  src/game-minute-transaction.test.ts \
  src/mobility-traffic-save-continuation.test.ts \
  src/economy-save-continuation.test.ts
pnpm --filter @web-three-city/game test
```

- [ ] **Step 7: Commit tests**:

```bash
git add apps/game/src/*temporal*.test.ts apps/game/src/simulation-runtime.test.ts apps/game/src/game-minute-transaction.test.ts apps/game/src/*save-continuation*.test.ts
git commit -m "test(game): freeze temporal release invariants"
```

---

### Task 2: Complete Active Game Composition Cutover

**Files:**
- Modify only if still needed after T5: `apps/game/src/game-minute-transaction.ts`
- Modify only if still needed: `apps/game/src/temporal-publication-controller.ts`
- Modify only if still needed: `apps/game/src/mobility-traffic-tick.ts`
- Modify only if still needed: `apps/game/src/application/save-coordinator.ts`
- Modify only if still needed: bootstrap/composition files discovered by the audit.
- Tests: owner Game tests from Task 1.

**Interfaces:** Active Game runtime consumes only the public temporal/domain APIs produced by T1–T5. Legacy readers/codecs can remain reachable from save decode, but active minute publication must not route through legacy facades.

- [ ] **Step 1: Inventory only the active application path**:

```bash
rg "absoluteTick|scheduleCursorDay|arrivedAtGameSecond|construction.*Tick|bornAtTick|evaluationTick|Math\.floor\([^\n]*/\s*60|\*\s*4|as unknown as (AbsoluteGameMinute|MacroHourIndex|AbsoluteTransportSecond)" \
  apps/game/src -g '*.ts'
```

Classify hits as `active runtime`, `legacy save decode`, `historical fixture`, or `test-only`.

- [ ] **Step 2: For every active-runtime hit, write or tighten an owner test that fails if the compatibility seam is used.
- [ ] **Step 3: Replace only those active-runtime seams with the T1–T5 owner API. Leave legacy reader fields intact for V1–V8 compatibility.
- [ ] **Step 4: Run Game + deployment GREEN**:

```bash
pnpm --filter @web-three-city/game test
pnpm test:deployment
```

- [ ] **Step 5: Commit only if production changes were necessary**:

```bash
git add apps/game/src
git commit -m "refactor(game): complete temporal release wiring"
```

If no active seam remains, record Task 2 as verification-only and make no no-op production commit.

---

### Task 3: Final Calendar/Clock HUD + Control Wiring

**Files:**
- Modify: `apps/game/src/game-time-presentation.ts` only if T4 left a release seam.
- Modify: `apps/game/src/ui/shell/game-hud.ts`
- Modify: `apps/game/src/ui/shell/simulation-controls.ts`
- Modify: `apps/game/src/ui/shell/player-shell.ts` only if projection wiring requires it.
- Modify: `apps/game/src/ui/shell/status-feedback.ts` only if temporal failure feedback is not already wired.
- Test: corresponding `.test.ts` files.

**Interfaces:** HUD displays the canonical projection produced by T4, not a local calculation:

```text
Calendar: Month 1..12 + Year >= 1
Clock:    HH:MM, 00:00..23:59
Controls: Pause | x1 | x2 | x4 | Step according to existing product surface
Failure:  bounded typed status, paused until explicit user recovery
```

Do not add a legacy Day 1..30 label.

- [ ] **Step 1: Write RED UI tests** for M1 23:59 -> M2 00:00, M12 -> next year, speed-state selection, pause, Step, and a temporal rejection status requiring explicit recovery.
- [ ] **Step 2: Add an assertion that the HUD/view model has no canonical day-of-month label or data dependency.
- [ ] **Step 3: Wire the already-derived Game time projection into `game-hud.ts`; do not calculate month/year/minute in the Lit/UI component.
- [ ] **Step 4: Preserve current compact mobile layout and existing control interactions. Do not relocate Build/tool/RCI surfaces as part of this program.
- [ ] **Step 5: Run shell + Game GREEN**:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/game-time-presentation.test.ts \
  src/ui/shell/game-hud.test.ts \
  src/ui/shell/simulation-controls.test.ts \
  src/ui/shell/player-shell-wiring.test.ts
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 6: Commit**:

```bash
git add apps/game/src/game-time-presentation.ts apps/game/src/game-time-presentation.test.ts apps/game/src/ui/shell
git commit -m "feat(ui): complete temporal release projection"
```

---

### Task 4: V9 Product Save/Load Acceptance Surface

**Files:**
- Test: `apps/game/src/application/save-coordinator.test.ts`
- Test: `apps/game/src/world-save-v9.test.ts`
- Modify/test Browser fixture: `apps/game/src/browser-world-save-fixture.ts`
- Browser: `browser-tests/citizen-mobility-traffic-save-load.@traffic@release.spec.ts`
- Browser: add/use a focused calendar/save release spec if T5 Browser authority does not already cover the HUD.

**Interfaces:** User-visible Save/Load writes V9, reads V1–V9, resumes canonical authority, and shows T4 calendar projection.

- [ ] **Step 1: Prove a fresh city saves V9 and reloads identical canonical world authority.
- [ ] **Step 2: Prove a representative V8 city is still discovered at the production storage address, migrates, and displays the reprojected calendar without citizen/construction jump.
- [ ] **Step 3: Prove an invalid/unknown V9 discriminator is rejected atomically and surfaced as bounded failure rather than partially replacing the city.
- [ ] **Step 4: Run focused unit/Game save tests before Browser.

---

### Task 5: Targeted Browser Release Evidence

**Files:** Existing/relevant specs under `browser-tests/`, including where applicable:

- `browser-tests/citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-mobile-regression.@traffic@interaction@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-save-load.@traffic@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts`
- `browser-tests/city-ui-responsive.@interaction@smoke@release.spec.ts`
- `browser-tests/city-ui-m6-4-mobile-declutter.@interaction@rci@release.spec.ts`
- `browser-tests/building.@building@visual@release.spec.ts`
- `browser-tests/simulation-inspection.spec.ts`
- focused compressed-calendar spec created in T4/T6 if needed.

**Interfaces:** Browser authority verifies actual DOM/input/canvas integration only; owner/domain tests remain arithmetic and deterministic authority.

- [ ] **Step 1: Build one exact Browser artifact**:

```bash
pnpm build:browser
```

- [ ] **Step 2: Run the resolver-selected targeted Chromium set** covering clock/speed, month/year rollover, V9 save/load, Building progress, RCI/Economy continuity, Mobility/Traffic continuity, and interaction safety.
- [ ] **Step 3: On failure, reproduce at the lowest proving layer first**. Do not add browser-only patches around domain defects.
- [ ] **Step 4: Rebuild once after any production fix and rerun the affected Browser authority.

---

### Task 6: Full Repository Release Gate

**Files:** Verification only unless a real defect is found.

- [ ] **Step 1: Run all temporal owner packages**:

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
```

- [ ] **Step 3: Resolve affected plan**:

```bash
pnpm verify:affected -- --base "$T6_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T6_BASE_SHA" --head HEAD --skip-browser
```

- [ ] **Step 4: Because T6 is the final product release cutover, run Full Browser if repository release policy/global authority selects it. Do not substitute targeted evidence when Full Browser is required.
- [ ] **Step 5: Run clean-worktree verification and report the two pre-existing protected untracked planning files separately if they still exist; tracked worktree must be clean.
- [ ] **Step 6: Non-force push only the GREEN candidate, open/retain Draft PR, then require exact-head GitHub Actions + Sonar before Ready/merge.

---

### Task 7: Owner Visual / Manual Acceptance at 414×896

**Human-only authority:** automation prepares the build/state and checklist but cannot mark these observations PASS.

- [ ] Clock visibly increments correctly in x1/x2/x4 and does not advance while paused.
- [ ] x4 remains the existing 250ms/GameMinute pacing; migration did not make it slower.
- [ ] `23:59 -> 00:00` visibly advances exactly one Calendar Month.
- [ ] Month 12 -> Month 1 visibly advances exactly one Calendar Year.
- [ ] No Day 1..30 legacy calendar label remains on the canonical HUD.
- [ ] Step advances exactly one normal GameMinute transaction.
- [ ] Growth/RCI/Economy/Mobility/Traffic continue across rollovers without freeze, duplicate cadence, or retry loop.
- [ ] A V8 migrated save resumes the same city authority with new calendar labels; citizen age/building construction do not jump.
- [ ] Fresh save/load uses V9 and resumes the same city.
- [ ] Temporal rejection pauses once, surfaces bounded feedback, and requires explicit recovery.
- [ ] Existing compact mobile HUD, Build menu, RCI demand presentation, camera visibility, and tool interaction remain usable; this program introduces no new full-screen clutter.

Record Owner result as `PASS`, `FAIL` with exact observation, or `RETEST REQUIRED`. Do not synthesize human approval.

---

## Exit Gate

T6 is release-complete only when:

- T1–T5 invariants are GREEN on the combined branch;
- active Game/UI path uses canonical temporal APIs and WorldSaveV9;
- calendar HUD is Month/Year + HH:MM with no legacy canonical day label;
- x1/x2/x4/pause/step and atomic rejection semantics are unchanged;
- Building/RCI/Economy/Mobility/Traffic behavior remains parity-equivalent;
- V1–V9 save/load product path is proven;
- required targeted and/or Full Browser gates are GREEN on the exact candidate;
- `pnpm check`, deployment, diff, and clean-worktree gates are GREEN;
- exact-head GitHub Actions and Sonar are GREEN;
- explicit human Owner Visual Acceptance at 414×896 is PASS.

Only after T6 is merged and release closure is recorded may T7 remove residual legacy runtime names/facades. T7 must not remove historical V1–V8 read support.
