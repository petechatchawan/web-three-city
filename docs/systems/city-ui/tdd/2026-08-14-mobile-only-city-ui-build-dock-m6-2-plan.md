# M6.2 Mobile-Only City UI / Build Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current always-visible build-category/tool-context stack with a Pocket-City-inspired mobile interaction hierarchy optimized for one canonical **414 × 896 CSS px portrait** viewport.

**Architecture:** Keep `.city-ui` as the sole UI runtime authority and keep all existing domain callbacks. Introduce a persistent mobile primary-actions surface with a prominent Build CTA, move Terrain/Roads/Zones/Buildings into a conditional Build Category Dock, reuse the existing tool/brush data behind a conditional Contextual Tool Dock, and replace the large Tool Context card with a compact transient status/Undo feedback surface. Do not create mirror state for world/domain data.

**Tech Stack:** TypeScript 6, DOM APIs, CSS, Vitest + happy-dom, Playwright Chromium, Vite, pnpm workspace.

## Global Constraints

- Canonical visual viewport: **414 × 896 CSS px, portrait**.
- M6.2 is mobile-only; tablet, desktop-specific layout redesign, landscape optimization, and breakpoint choreography are out of scope.
- Pocket City screenshots are interaction/hierarchy references, not pixel-perfect artwork targets.
- Do not change Terrain, Roads, Zoning, Buildings, Economy, simulation authority, Save/Load semantics, Undo authority, or world interaction semantics.
- `.city-ui` remains the single runtime UI authority; do not restore the legacy game-ui mount.
- Minimum direct touch target remains **44 CSS px**.
- Speed semantics remain `Paused → 1× → 2× → 4× → Paused`; Step exists only while paused.
- Build closed must not permanently show Terrain/Roads/Zones/Buildings.
- Default idle/ready state must not reserve map space with a Tool Context card.
- Final gate: `pnpm check` → 129-test Full Browser suite → clean-worktree → owner manual visual acceptance at exactly 414×896.

---

## File Structure

### New focused presentation units

- `apps/game/src/ui/shell/primary-actions.ts` — persistent mobile bottom chrome; owns Navigate and Build CTA interaction only.
- `apps/game/src/ui/shell/primary-actions.test.ts` — RED/GREEN contract for Build CTA and Navigate action.
- `apps/game/src/ui/shell/build-category-dock.ts` — conditional Terrain/Roads/Zones/Buildings/Close category dock; no world mutation itself.
- `apps/game/src/ui/shell/build-category-dock.test.ts` — open/close/selection/active-state contracts.
- `apps/game/src/ui/shell/status-feedback.ts` — transient event feedback and compact Undo action; no permanent idle card.
- `apps/game/src/ui/shell/status-feedback.test.ts` — idle-hidden/status/Undo contracts.
- `apps/game/src/ui/m6-2-mobile.css` — canonical 414×896 layout and visual hierarchy; no breakpoint choreography.

### Existing units to change

- `apps/game/src/ui/shell/player-shell.ts` — compose new persistent primary actions, Build Category Dock, contextual tool dock, status feedback, HUD and top actions.
- `apps/game/src/ui/shell/player-shell.test.ts` — shell state model: Navigate → Build open → category/tool active → Build close.
- `apps/game/src/ui/shell/player-shell-wiring.test.ts` — preserve callbacks and dialog/tool semantics through new shell composition.
- `apps/game/src/ui/shell/subtool-tray.ts` — presentation role becomes Contextual Tool Dock; retain existing tool definitions and brush callbacks.
- `apps/game/src/ui/shell/subtool-tray.test.ts` — assert horizontal tool row and Terrain-only brush composition without permanent Tool Context child.
- `apps/game/src/ui/shell/tool-context-sheet.ts` — retire as visible persistent tool card; either reduce to compatibility adapter over status feedback or remove after consumers migrate.
- `apps/game/src/ui/city-ui-runtime.ts` — expose status feedback adapter through existing runtime seam and keep world projections unchanged.
- `apps/game/src/ui/city-ui-runtime.test.ts` — ensure status/Undo runtime seam remains reachable and shell is the only UI mount.
- `apps/game/src/ui/shell/game-hud.ts` / `game-hud.test.ts` — primary mobile metrics only in persistent HUD; secondary metrics remain accessible through management dialogs rather than permanent chrome.
- `apps/game/src/ui/city-ui.css` — remove/neutralize M6/M6.1 rules that conflict with M6.2 mobile hierarchy.
- `apps/game/src/main.ts` or existing stylesheet entrypoint — import `m6-2-mobile.css` last so it is the presentation authority for the canonical viewport.
- browser specs that currently assume five persistent build nav items or visible Tool Context: `browser-tests/city-ui-responsive.@interaction@smoke@release.spec.ts`, `browser-tests/interaction-conformance.@interaction@smoke.spec.ts`, `browser-tests/growth.@building.spec.ts`, `browser-tests/road-visual-evidence.@road@visual@release.spec.ts`, `browser-tests/zoning-visual-evidence.@zoning@visual@release.spec.ts`, and any helper using `nav-terrain/nav-roads/nav-zones/nav-buildings` directly.

---

### Task 1: RED — Lock the Mobile Shell State Model

**Files:**
- Create: `apps/game/src/ui/shell/primary-actions.test.ts`
- Create: `apps/game/src/ui/shell/build-category-dock.test.ts`
- Modify: `apps/game/src/ui/shell/player-shell.test.ts`

**Interfaces:**
- Produces expected `PrimaryActions` contract: `element`, `setBuildOpen(open: boolean)`, `dispose()`.
- Produces expected `BuildCategoryDock` contract: `element`, `open()`, `close()`, `setActiveCategory(category)`, `dispose()`.
- Player shell state contract uses existing `selectTool(GameToolMode)` callback and does not introduce domain state.

- [ ] **Step 1: Write failing Primary Actions tests**

Assert the persistent bottom surface contains a small Navigate action and one prominent `[data-testid="build-cta"]`, but no persistent Terrain/Roads/Zones/Buildings buttons.

```ts
expect(element.querySelector('[data-testid="primary-navigate"]')).not.toBeNull();
expect(element.querySelector('[data-testid="build-cta"]')).not.toBeNull();
expect(element.querySelector('[data-nav-category="terrain"]')).toBeNull();
```

- [ ] **Step 2: Write failing Build Category Dock tests**

Assert the dock starts hidden, opens without firing a category callback, exposes exactly Terrain/Roads/Zones/Buildings/Close, and updates `aria-pressed` for the selected category.

- [ ] **Step 3: Rewrite the shell composition test into the M6.2 state model**

Required assertions:

```text
initial: primary actions visible, build dock hidden, contextual dock hidden
Build CTA: build dock visible, contextual dock hidden, tool remains Navigate
Terrain: selectTool('raise'), build dock remains visible, contextual dock shows Raise/Lower/Flatten + brush
Close Build: selectTool('navigate'), both conditional docks hidden
```

- [ ] **Step 4: Run only these tests and verify RED**

Run:

```bash
pnpm --filter @web-three-city/game test --run \
  src/ui/shell/primary-actions.test.ts \
  src/ui/shell/build-category-dock.test.ts \
  src/ui/shell/player-shell.test.ts
```

Expected: FAIL because `primary-actions.ts` and `build-category-dock.ts` do not exist and current shell still mounts five persistent build categories.

- [ ] **Step 5: Commit RED tests only**

```bash
git add apps/game/src/ui/shell/*test.ts
git commit -m "test(city-ui): lock M6.2 mobile shell state model"
```

---

### Task 2: GREEN — Add Primary Actions and Conditional Build Category Dock

**Files:**
- Create: `apps/game/src/ui/shell/primary-actions.ts`
- Create: `apps/game/src/ui/shell/build-category-dock.ts`
- Modify: `apps/game/src/ui/shell/player-shell.ts`
- Retire from composition: `apps/game/src/ui/shell/bottom-nav.ts`

**Interfaces:**

```ts
export interface PrimaryActions {
  readonly element: HTMLElement;
  setBuildOpen(open: boolean): void;
  dispose(): void;
}

export interface PrimaryActionCallbacks {
  readonly onNavigate: () => void;
  readonly onToggleBuild: () => void;
}

export type BuildCategory = 'terrain' | 'roads' | 'zones' | 'buildings';

export interface BuildCategoryDock {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  setActiveCategory(category: BuildCategory | null): void;
  dispose(): void;
}
```

- [ ] **Step 1: Implement Primary Actions minimally**

DOM contract:

```text
nav.city-primary-actions
├── button[data-testid=primary-navigate]
└── button.city-build-cta[data-testid=build-cta]
```

Build CTA must have visible `Build` text plus icon and `aria-expanded` reflecting dock state.

- [ ] **Step 2: Implement Build Category Dock minimally**

DOM contract:

```text
nav.city-build-category-dock[hidden]
├── Terrain
├── Roads
├── Zones
├── Buildings
└── Close
```

Opening the dock alone must not call `selectTool`.

- [ ] **Step 3: Recompose `mountPlayerShell`**

State transitions:

```ts
Navigate -> Build CTA -> buildOpen=true
category click -> active category + default tool + contextual dock
Close Build / Navigate -> selectTool('navigate') + hide both docks
```

Keep simulation controls nested in `city-top-actions` exactly as M6.1 established.

- [ ] **Step 4: Run Task 1 tests and verify GREEN**

Use the Task 1 command; expected all PASS.

- [ ] **Step 5: Run existing wiring tests**

```bash
pnpm --filter @web-three-city/game test --run \
  src/ui/shell/player-shell-wiring.test.ts \
  src/ui/shell/subtool-tray.test.ts \
  src/ui/shell/simulation-controls.test.ts
```

Expected: PASS or reveal only presentation-contract migrations; no domain callback changes are allowed.

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/ui/shell
git commit -m "feat(city-ui): add mobile Build entry hierarchy"
```

---

### Task 3: RED/GREEN — Retire Permanent Tool Context and Add Transient Status Feedback

**Files:**
- Create: `apps/game/src/ui/shell/status-feedback.test.ts`
- Create: `apps/game/src/ui/shell/status-feedback.ts`
- Modify: `apps/game/src/ui/shell/player-shell.ts`
- Modify: `apps/game/src/ui/city-ui-runtime.ts`
- Modify: `apps/game/src/ui/city-ui-runtime.test.ts`
- Modify or remove after migration: `apps/game/src/ui/shell/tool-context-sheet.ts`

**Interfaces:**

```ts
export interface StatusFeedbackAdapter {
  readonly element: HTMLElement;
  setUndoAvailable(available: boolean): void;
  setStatus(value: string): void;
  clearStatus(): void;
  dispose(): void;
}
```

For compatibility during this task, `CityUiRuntime.toolContextSheet` may be renamed to `statusFeedback` only if every consumer is migrated in the same commit. Prefer one authority; do not keep both adapters.

- [ ] **Step 1: Write RED status-feedback tests**

Contracts:

```text
initial: feedback hidden; no Ready / Point at the world / Undo unavailable text
setStatus('Road built'): compact feedback visible with exact message
setUndoAvailable(true): small Undo button visible/enabled
setUndoAvailable(false): Undo action hidden, not a disabled permanent control
clearStatus(): status text removed and surface hidden unless Undo remains available
```

- [ ] **Step 2: Run RED test**

Expected: missing module / old Tool Context semantics fail.

- [ ] **Step 3: Implement `status-feedback.ts`**

Use a compact `role="status"` surface; keep the existing Undo callback authority. Do not synthesize success strings here; consume the status strings already published by runtime/domain bridges.

- [ ] **Step 4: Remove permanent tool projection from `player-shell.ts`**

Delete `projectTool()` and all default messages such as `Point at the world to preview this tool`. Active tool is represented by selected contextual tool button.

- [ ] **Step 5: Rebind runtime status/Undo seam**

Update `city-ui-runtime.ts` and its consumer type so existing callers of `setStatus()` / `setUndoAvailable()` target the single status-feedback adapter.

- [ ] **Step 6: Run RED tests plus runtime tests**

```bash
pnpm --filter @web-three-city/game test --run \
  src/ui/shell/status-feedback.test.ts \
  src/ui/city-ui-runtime.test.ts \
  src/ui/shell/player-shell-wiring.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui
git commit -m "feat(city-ui): replace tool context card with transient feedback"
```

---

### Task 4: GREEN — Make the Contextual Tool Dock Mobile-Compact

**Files:**
- Modify: `apps/game/src/ui/shell/subtool-tray.ts`
- Modify: `apps/game/src/ui/shell/subtool-tray.test.ts`
- Modify: `apps/game/src/ui/shell/brush-stepper.ts` only if class/test hooks need semantic naming; do not change brush values.

**Interfaces:**
- Reuse existing `TrayCategory`, existing tool tuples, and `onSelectTool(GameToolMode)` / `onBrush(1|3|5)` callbacks.
- The component remains hidden until a Build category is selected.

- [ ] **Step 1: Update tests first**

Assert:

```text
Zones exposes four tool buttons in one scrollable row and does not wrap by DOM grouping
Terrain exposes Raise/Lower/Flatten plus exactly one brush selector
Roads exposes exactly Build Road/Bulldoze Road
Buildings exposes current product action only
no Tool Context child exists inside the dock
```

- [ ] **Step 2: Run updated test and observe RED where old composition is still assumed**

- [ ] **Step 3: Rename presentation classes without changing tool semantics**

Use `.city-contextual-tool-dock` as the primary class; keeping `data-testid="subtool-tray"` temporarily is acceptable for browser migration, but the final permanent selector should be semantic M6.2 naming.

- [ ] **Step 4: Run subtool/brush/player-shell tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/ui/shell/subtool-tray* apps/game/src/ui/shell/brush-stepper*
git commit -m "refactor(city-ui): make contextual build tools a compact dock"
```

---

### Task 5: RED/GREEN — Canonical 414×896 HUD and Visual Hierarchy

**Files:**
- Modify: `apps/game/src/ui/shell/game-hud.test.ts`
- Modify: `apps/game/src/ui/shell/game-hud.ts`
- Create: `apps/game/src/ui/m6-2-mobile.css`
- Modify: stylesheet entrypoint/import ordering.
- Modify/neutralize superseded M6.1 presentation CSS only where it conflicts with M6.2.

**Interfaces:**
- `GameHudProjection` remains unchanged so Economy/RCI/time authority does not move.
- Persistent visible metrics at canonical mobile viewport: Population, Treasury, Game time.
- Secondary `net/demand/construction/active/total` values may remain in projection and management dialogs but must not occupy permanent HUD chrome.

- [ ] **Step 1: Change HUD test to require only three persistent metric buttons**

Still verify their existing metric callbacks and projection updates.

- [ ] **Step 2: Run HUD test and verify RED against current eight-metric permanent HUD**

- [ ] **Step 3: Implement compact HUD DOM**

Keep icon + value; subordinate or shorten labels. Do not format authoritative values differently in TypeScript unless an existing formatting helper is used; presentation truncation belongs in CSS.

- [ ] **Step 4: Add `m6-2-mobile.css` as final presentation authority**

Canonical geometry at 414×896:

```text
Top: compact HUD left/top + icon-first top actions right/top
Middle: unobstructed world
Bottom persistent: small Navigate utility + large Build CTA
When Build open: category dock immediately above primary actions
When category active: contextual dock immediately above category dock
Transient feedback: directly above conditional docks; no reserved idle height
```

Specific CSS requirements:

- No media-query choreography is required for M6.2.
- `.city-build-cta` receives strongest accent fill and wider horizontal footprint.
- `.city-build-category-dock` is a compact five-item horizontal dock.
- `.city-contextual-tool-dock-content` is `display:flex; overflow-x:auto; flex-wrap:nowrap`.
- Terrain brush is a compact secondary row.
- `.city-status-feedback[hidden] { display:none; }`.
- Existing dark inactive tool controls explicitly set icon/text foreground; do not rely on inherited `color`.
- Direct controls remain ≥44px.

- [ ] **Step 5: Run game unit tests**

```bash
pnpm --filter @web-three-city/game test --run
```

Expected: all game tests PASS.

- [ ] **Step 6: Run typecheck + build**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui apps/game/src/main.ts
# use the actual stylesheet entrypoint if not main.ts
git commit -m "style(city-ui): establish canonical 414x896 mobile HUD"
```

---

### Task 6: RED/GREEN — Migrate Browser Interaction Contracts to Build CTA Flow

**Files:**
- Modify relevant browser helper(s) that select Terrain/Roads/Zones/Buildings.
- Modify: `browser-tests/city-ui-responsive.@interaction@smoke@release.spec.ts`
- Modify: `browser-tests/interaction-conformance.@interaction@smoke.spec.ts`
- Modify growth/road/zoning visual specs that directly select persistent nav categories.
- Keep Playwright test inventory at 26 specs / 129 tests unless a deliberate replacement is required.

**Interfaces:**

Introduce/reuse one helper flow rather than duplicating clicks:

```ts
async function openBuildCategory(page: Page, category: 'terrain'|'roads'|'zones'|'buildings') {
  await page.getByTestId('build-cta').click();
  await page.getByTestId(`build-category-${category}`).click();
}
```

- [ ] **Step 1: Change canonical mobile browser assertion to exactly 414×896**

Required state checks:

```text
Build closed: Build CTA visible; build category dock/contextual dock hidden
Build open: category dock visible; contextual dock hidden
Terrain: contextual dock + brush visible
Zones: all four tools reachable without page horizontal overflow
Close: returns to Navigate and hides conditional docks
```

- [ ] **Step 2: Run only the responsive/interaction specs and verify RED before helper/product migration is complete**

```bash
pnpm exec playwright test \
  browser-tests/city-ui-responsive.@interaction@smoke@release.spec.ts \
  browser-tests/interaction-conformance.@interaction@smoke.spec.ts
```

- [ ] **Step 3: Migrate all direct build-category selectors through the Build CTA helper**

Do not use forced clicks to mask layout failures.

- [ ] **Step 4: Run targeted browser suites**

Run City UI + Terrain + Road + Zoning + Building/Growth specs that exercise shell controls. Expected all PASS.

- [ ] **Step 5: Commit**

```bash
git add browser-tests
git commit -m "test(city-ui): migrate browser flows to mobile Build dock"
```

---

### Task 7: Verification Closure and PR #59 Integration

**Files:**
- Modify: `docs/systems/city-ui/verification/2026-08-10-legacy-game-ui-mount-retirement-closure.md`
- Modify PR #59 description after exact-head verification.

- [ ] **Step 1: Run full static/unit/build gate**

```bash
pnpm check
```

Expected: exit 0.

- [ ] **Step 2: Run Full Browser suite**

CI policy: one browser worker on GitHub-hosted SwiftShader; local default remains two workers.

```bash
CI=1 pnpm test:browser:only
```

Expected: **129 passed, 0 failed**.

- [ ] **Step 3: Run clean-worktree gate**

```bash
node tooling/verify-clean-worktree.mjs
```

Expected: `Working tree is clean.`

- [ ] **Step 4: Integrate staging branch into `feat/light-theme-mobile-first-shell` using SHA fencing**

Do not merge to `master`.

- [ ] **Step 5: Force Full CI on exact PR #59 head**

Required evidence:

```text
Lean CI PASS
Full Browser 129/129 PASS
clean-worktree PASS
```

- [ ] **Step 6: Update closure record and PR #59 body**

Record M6.2 exact head and state:

```text
Automated acceptance: PASS
Manual visual acceptance at 414×896: PENDING
master merge: BLOCKED
```

- [ ] **Step 7: Owner manual visual acceptance**

Owner checks exactly 414×896 for the ten states frozen in the M6.2 design spec. Only an explicit PASS authorizes squash-merge PR #59 into `master`.

---

## Plan Self-Review

- Spec coverage: all M6.2 sections 1–14 map to Tasks 1–7.
- Scope: no new gameplay/domain behavior; no building-catalog expansion; no responsive redesign.
- Authority: existing domain callbacks and world projections remain the only sources of truth.
- Mobile hierarchy: Build CTA, conditional category dock, conditional contextual dock, transient feedback, and compact HUD are each owned by one presentation unit.
- TDD: shell state, status feedback, HUD reduction, and browser Build flow each have explicit RED commands before GREEN.
- Verification: exact-head static/unit/build, full 129 browser tests, clean-worktree, then owner visual acceptance.
- Placeholder scan: no TBD/TODO/implementation-later steps remain.
