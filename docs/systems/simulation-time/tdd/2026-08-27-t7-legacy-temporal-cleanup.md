# T7 Legacy Temporal Runtime Surface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove residual ambiguous temporal names, temporary runtime compatibility facades, duplicate conversion constants, and unsafe temporal escapes left after T1–T6, while preserving historical V1–V8/domain legacy save readers exactly and changing no simulation behavior.

**Architecture:** T7 is a cleanup/enforcement slice, not another temporal migration. Canonical runtime code must speak only the explicit T1–T5 vocabulary (`AbsoluteGameMinute`, macro-hour points/durations, Simulation Cycle counters, Traffic transport points/durations, compressed calendar projection). Historical wire vocabulary may survive only inside clearly isolated persistence/migration DTOs and tests that prove legacy readability; architecture tooling makes that distinction executable so ambiguous names cannot leak back into runtime APIs.

**Tech Stack:** TypeScript 6, Node test/AST architecture tooling, Vitest 4, Playwright 1.61, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Prerequisites and Branch Rule

- T6 must be merged with exact-head CI/Sonar, required Browser gates, and explicit Owner Visual Acceptance PASS.
- Create `refactor/t7-temporal-legacy-cleanup` from the then-current verified `master`.
- Record `T7_BASE_SHA=$(git rev-parse HEAD)` before the first RED.
- T7 may delete/rename only compatibility surfaces proven unused by active runtime. It must not delete V1–V8 WorldSave readers or older domain codec readers required by WorldSave migration.

## Global Constraints

- No product behavior change: canonical minute values, compressed calendar labels, playback, Building/RCI/Economy/Mobility/Traffic cadence, route/physics, Growth, and save semantics are frozen from T6.
- WorldSaveV9 remains canonical writer; V1–V9 remain readable.
- Legacy JSON property names are allowed only where required to parse historical save versions.
- Do not rename historical wire bytes/JSON keys merely for style; isolate them behind legacy DTO/codec boundaries.
- No second clock, no new temporal unit, no new calendar policy, no speed tuning.
- No direct or double-cast construction of canonical temporal point/duration types outside trusted constructors/codecs.
- No raw cross-unit conversion arithmetic in consumers (`* 60`, `/ 60`, `* 4`, `/ 4`, equivalent `Math.floor` formulas) where an owner API exists.
- No compatibility facade may remain exported from a package public `index.ts` unless a current non-legacy consumer is proven to require it; if such a consumer exists, migrate the consumer first.
- T7 is expected to change architecture tooling and therefore may legitimately trigger GLOBAL/Full Browser verification.

## Forbidden Runtime Vocabulary After T7

Outside legacy persistence/migration DTOs and historical tests, the following families are forbidden:

```text
absoluteTick
*AtTick
*Tick / *Ticks when they denote simulation time
scheduleCursorDay
arrivedAtGameSecond
GameSecond when used as Traffic transport authority
legacy day/month runtime calendar helpers
Math.floor(gameMinute / 60)
gameMinute * 4
arrivedAtGameSecond * 4
raw temporal point +/- number
raw comparison across unlike temporal types
as AbsoluteGameMinute
as MacroHourIndex
as MacroHourDuration
as AbsoluteTransportSecond
as TransportSecondDuration
as unknown as <any temporal type>
```

Terms such as ordinary test “tick” prose that do not denote a persisted/runtime temporal unit are not renamed mechanically; classification is semantic.

---

### Task 1: Create an Executable Legacy-Surface Inventory Gate

**Files:**
- Create: `tooling/temporal-legacy-surface.test.mjs`
- Modify: `tooling/temporal-unit-boundary.test.mjs` only where overlapping type-escape logic should be shared rather than duplicated.
- Create/modify fixtures under: `tooling/architecture-fixtures/temporal-unit-violations/`
- Test: deployment/architecture suite.

**Interfaces:** The new gate scans production TypeScript under `packages/*/src` and `apps/game/src` and classifies findings into exactly two categories:

```text
ACTIVE_RUNTIME_FORBIDDEN
LEGACY_CODEC_ALLOWED
```

A legacy allowance is valid only when all are true:

1. file is an owning persistence/serialization/migration module;
2. identifier/property belongs to a historical schema/DTO or legacy migration function;
3. the legacy value is converted immediately through an owner validating constructor/helper before entering runtime state;
4. the legacy symbol is not re-exported as canonical runtime API.

- [ ] **Step 1: Add failing fixtures** for each forbidden class:

```ts
const a = value as AbsoluteGameMinute;
const b = value as unknown as MacroHourIndex;
const c = gameMinute * 4;
const d = Math.floor(gameMinute / 60);
const e = { scheduleCursorDay: 3 };
const f = { arrivedAtGameSecond: 10 };
```

Also add allowed fixtures representing a `SimulationSaveV1.absoluteTick` DTO and a historical codec that immediately calls the canonical constructor/migration helper.

- [ ] **Step 2: Implement the scanner with AST/source-location diagnostics**. It must print `path:line`, identifier/pattern, and classification reason for every violation; no silent broad directory ignore.
- [ ] **Step 3: Add public-export checks** by reading each affected package `src/index.ts`; a legacy schema type/decoder may be exported if required for V1–V8 read compatibility, but a legacy runtime conversion facade may not be exported as canonical API.
- [ ] **Step 4: Run RED against the current repository**:

```bash
node --test tooling/temporal-legacy-surface.test.mjs
```

Expected: FAIL with the concrete residual runtime inventory that T7 will remove.

- [ ] **Step 5: Save the initial violation list in the commit message/PR evidence, not as a permanent hand-maintained allowlist file.
- [ ] **Step 6: Commit the gate while RED is local only; do not push known RED. Continue immediately to the cleanup tasks, then commit/push only a GREEN candidate according to repository workflow.

---

### Task 2: Clean Simulation-Core Runtime Facades While Keeping V1/V2 Readers

**Files:**
- Modify: `packages/simulation-core/src/calendar.ts`
- Modify: `packages/simulation-core/src/calendar-policy.ts`
- Modify: `packages/simulation-core/src/serialization.ts`
- Modify: `packages/simulation-core/src/index.ts`
- Test: simulation calendar/serialization tests.

**Interfaces:** Canonical public runtime API after T7 is centered on:

```text
AbsoluteGameMinute
GameMinuteDuration
MacroHourIndex
MacroHourDuration
deriveGameCalendarFromGameMinute
simulationCycleIndexAtGameMinute
compressed-calendar constants
```

Historical `SimulationSaveV1/V2.absoluteTick` remains a wire field decoded inside serialization; it is not a runtime clock API.

- [ ] **Step 1: Use the Task 1 report to identify any exported `deriveGameCalendar(absoluteTick)`, `assertAbsoluteTick`, `MINUTES_PER_HOUR` legacy-runtime helper, or equivalent compatibility facade still consumed outside serialization/tests.
- [ ] **Step 2: For each real consumer, change its test first to the canonical AbsoluteGameMinute API and run RED/typecheck.
- [ ] **Step 3: Migrate consumers, then make legacy V1/V2 hour-tick conversion private to `serialization.ts` or an explicitly named legacy codec helper.
- [ ] **Step 4: Remove legacy calendar facade exports only after `rg` proves zero active consumers:

```bash
rg "deriveGameCalendar\(|assertAbsoluteTick|absoluteTick|MINUTES_PER_HOUR" packages apps/game/src -g '*.ts'
```

Expected residual `absoluteTick` hits: historical Simulation V1/V2 DTO/codec/tests only.

- [ ] **Step 5: Run Simulation full suite/typecheck/build and architecture gates GREEN.
- [ ] **Step 6: Commit**:

```bash
git add packages/simulation-core tooling
git commit -m "refactor(simulation): retire legacy temporal runtime facades"
```

---

### Task 3: Isolate Building, RCI, and Economy Legacy Wire Vocabulary

**Files:**
- Modify as required by inventory: Building persistence/serialization and `src/index.ts`.
- Modify as required: RCI persistence/migration and `src/index.ts`.
- Modify as required: Economy serialization and `src/index.ts`.
- Modify active consumers found outside codec modules.
- Tests: owner persistence/runtime suites.

**Interfaces:** Canonical runtime vocabulary is explicit macro-hour semantics. Historical wire names remain only in older schema DTOs/decoders:

```text
Building V1/V2: constructionStartedAtTick, constructionCompletesAtTick, activatedAtTick
RCI V1: bornAtTick and historical *Tick fields
Economy V1: lastDailySettlementTick, lastMonthlyCloseTick
```

V3/V2/V2 canonical writers created in T5 use explicit names and must not emit those fields.

- [ ] **Step 1: Run owner-specific inventories**:

```bash
rg "Tick|Ticks|AtTick" packages/building-core/src packages/rci-core/src packages/economy-core/src -g '*.ts'
```

- [ ] **Step 2: Classify every hit**. Any hit in lifecycle/domain/runtime modules is RED and must be migrated; hits in historical DTOs/decoders are retained and must be explicitly named/versioned.
- [ ] **Step 3: Tighten owner tests first for any runtime hit**, then cut the consumer to `MacroHourIndex`/`MacroHourDuration` owner APIs.
- [ ] **Step 4: Prevent legacy DTOs from escaping** by ensuring new V3/V2/V2 encoders and runtime constructors never accept old `*Tick` record shapes.
- [ ] **Step 5: Prove historical readers still work** with V1/V2 fixtures and that canonical writer output contains no ambiguous fields.
- [ ] **Step 6: Run GREEN**:

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
```

- [ ] **Step 7: Commit**:

```bash
git add packages/building-core packages/rci-core packages/economy-core
git commit -m "refactor(domains): isolate legacy macro-hour wire names"
```

---

### Task 4: Isolate Mobility and Traffic Legacy Temporal Vocabulary

**Files:**
- Modify: `packages/citizen-mobility-core/src/persistence.ts` and `src/index.ts` as required.
- Modify: `packages/traffic-core/src/persistence.ts`, transport migration helper, and `src/index.ts` as required.
- Modify active Game consumers if inventory finds leakage.
- Tests: Mobility/Traffic persistence + runtime suites.

**Interfaces:**

- `scheduleCursorDay` may exist only in Mobility V1/V2 historical wire DTOs if those schemas require it; canonical runtime/V3 writer uses the T3A cycle semantic name.
- `arrivedAtGameSecond` may exist only in Traffic V1 historical wire DTO/migration; canonical runtime/V3 writer uses `arrivedAtTransportSecond`.
- Four-quanta conversion remains only in the Traffic-owned checked conversion/migration authority.

- [ ] **Step 1: Inventory**:

```bash
rg "scheduleCursorDay|arrivedAtGameSecond|GameSecond|\*\s*4|/\s*4|TRANSPORT_QUANTA_PER_GAME_MINUTE" \
  packages/citizen-mobility-core/src packages/traffic-core/src apps/game/src -g '*.ts'
```

- [ ] **Step 2: Write RED tests/architecture expectations for any active-runtime leakage.
- [ ] **Step 3: Remove duplicate Game/consumer conversion constants and route all cross-unit conversion through Traffic-owned APIs.
- [ ] **Step 4: Keep V1/V2 legacy reader DTOs exact; do not rewrite historical JSON keys.
- [ ] **Step 5: Prove Mobility commute parity, Traffic four-quanta/physical parity, and V1/V2->V3 save continuation.
- [ ] **Step 6: Run GREEN**:

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
```

- [ ] **Step 7: Commit**:

```bash
git add packages/citizen-mobility-core packages/traffic-core apps/game/src
git commit -m "refactor(mobility-traffic): retire legacy runtime time seams"
```

---

### Task 5: Remove Game/Application Temporal Escape Hatches

**Files:**
- Search/modify: `apps/game/src/**/*.ts`
- Test: Game temporal publication, save, bootstrap, projection, and fixture suites.

**Interfaces:** Game orchestrates typed owner APIs only. It may inspect numeric wire primitives only inside world/domain codec orchestration; application runtime must not derive domain time units itself.

- [ ] **Step 1: Run complete Game inventory**:

```bash
rg "absoluteTick|AtTick|scheduleCursorDay|arrivedAtGameSecond|Math\.floor\([^\n]*/\s*60|\*\s*4|as unknown as (AbsoluteGameMinute|GameMinuteDuration|MacroHourIndex|MacroHourDuration|AbsoluteTransportSecond|TransportSecondDuration)" \
  apps/game/src -g '*.ts'
```

- [ ] **Step 2: For each active hit, identify the owning package API, add a focused failing test, and replace the escape with that API.
- [ ] **Step 3: Historical world-save migration fixtures may retain legacy property names, but they must not be used as runtime state after decode.
- [ ] **Step 4: Remove temporary compatibility adapters/facades that have zero callers after T1–T6. Before deletion, prove zero callers with `rg` and run the nearest owner test.
- [ ] **Step 5: Run Game full suite/typecheck + deployment GREEN.
- [ ] **Step 6: Commit**:

```bash
git add apps/game/src
git commit -m "refactor(game): remove temporal compatibility escapes"
```

---

### Task 6: Freeze the Final Public Temporal API and Documentation

**Files:**
- Modify: `tooling/temporal-unit-boundary.test.mjs`
- Modify: `tooling/temporal-legacy-surface.test.mjs`
- Modify: `docs/systems/simulation-time/README.md`
- Modify: `docs/systems/simulation-time/tdd/2026-08-26-temporal-successor-execution-index.md`
- Modify: affected system READMEs for Buildings, RCI, Economy, Citizen Mobility, Traffic, World where stale names remain.

**Interfaces:** Documentation and architecture gates must describe exactly the post-T7 canonical vocabulary and the legacy-reader exception.

- [ ] **Step 1: Make the legacy-surface gate GREEN with zero `ACTIVE_RUNTIME_FORBIDDEN` findings.
- [ ] **Step 2: Add regression fixtures proving a future exported `*Tick`, raw `*4`, raw `/60`, or double-cast temporal escape fails deployment/architecture verification.
- [ ] **Step 3: Update system docs** so runtime examples use only canonical names; put historical wire names under an explicit “Legacy persistence compatibility” section rather than presenting them as current architecture.
- [ ] **Step 4: Update the execution index** to mark T1–T7 complete only after implementation/merge evidence exists; during the PR, mark T7 candidate rather than claiming merged status.
- [ ] **Step 5: Run docs/provenance/architecture checks and `git diff --check`.
- [ ] **Step 6: Commit**:

```bash
git add tooling docs/systems
git commit -m "docs(time): freeze canonical temporal public surface"
```

---

### Task 7: Prove No Behavioral or Persistence Regression

**Files:** Verification/tests only unless a real regression is found.

- [ ] **Step 1: Re-run every temporal owner suite**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
```

- [ ] **Step 2: Run all architecture/deployment gates**:

```bash
node --test tooling/temporal-unit-boundary.test.mjs
node --test tooling/temporal-legacy-surface.test.mjs
pnpm test:deployment
pnpm check
git diff --check
```

- [ ] **Step 3: Re-run V1–V9 golden migration/roundtrip and `23:59 -> 00:00` continuation evidence. T7 must produce exactly the same semantic results and V9 writer bytes as T6 unless a deterministic serialization ordering normalization was already locked by T5.
- [ ] **Step 4: Run affected verification**:

```bash
pnpm verify:affected -- --base "$T7_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T7_BASE_SHA" --head HEAD --skip-browser
```

Because architecture tooling changes, expect conservative GLOBAL/Full Browser escalation and honor it.

- [ ] **Step 5: Build exact Browser artifact and run required Browser authority. No new Owner visual design decision is expected; this is regression evidence against T6 accepted UI.
- [ ] **Step 6: Run clean-worktree verification; report protected user-owned untracked files separately if still present.
- [ ] **Step 7: Non-force push only the GREEN candidate; require exact-head GitHub Actions + Sonar before Ready/merge.

---

## Exit Gate

The Temporal Authority program is technically closed after T7 only when:

- zero active-runtime ambiguous temporal names remain outside explicitly versioned legacy persistence/migration code;
- no runtime consumer performs raw minute/hour or GameMinute/transport conversion arithmetic owned elsewhere;
- no direct/double-cast temporal escape remains outside trusted constructors/codecs;
- package public APIs expose canonical temporal semantics only, except explicitly historical save types/decoders required for compatibility;
- WorldSaveV1–V9 readers remain GREEN and canonical writer remains V9;
- V9 writer semantics/bytes, canonical minute, compressed calendar, playback, domain cadence, Traffic physics, and UI behavior are unchanged from T6;
- architecture tooling prevents reintroduction of the removed seams;
- all owner/Game/deployment/check/Browser/CI/Sonar gates are GREEN.

T7 does **not** require a new Owner Visual Acceptance unless the cleanup unexpectedly changes rendered UI. If any rendered behavior changes, stop and treat it as a regression against the T6 accepted product rather than expanding T7 scope.
