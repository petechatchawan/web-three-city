# M6.3 Figma Fidelity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the production mobile City UI shell over to the supplied Figma mobile gameplay architecture at canonical 414×896 without changing gameplay/domain/save/undo/simulation authority.

**Architecture:** Re-activate a single persistent `BottomNav` as the mobile shell owner for Terrain/Roads/Zones/Build/City, move direct simulation controls into that bottom chrome, restore the complete five-value compact HUD, and replace transient-only status feedback with a projection-driven collapsible context sheet. Existing runtime callbacks remain the only mutation authorities; presentation components only select, project, and navigate.

**Tech Stack:** TypeScript 6, DOM UI components, Vitest/happy-dom, Playwright, CSS, existing Three.js game runtime.

## Global Constraints

- Canonical release viewport is **414 × 896 portrait**.
- Figma export is visual/layout/interaction authority; production runtime is gameplay/data authority.
- Do not fabricate Figma mock costs, validation, or state values when production has no authoritative source.
- No persistent Navigate button.
- Persistent mobile nav is exactly `Terrain | Roads | Zones | Build | City`.
- Simulation exposes direct `Pause | Play | 2× | 4×`; Step appears only while paused.
- Existing Terrain/Road/Zoning/Building mutation semantics remain unchanged.
- Existing save/load, Undo, Economy, RCI, GameTime, camera and dialog authorities remain unchanged.
- Preserve repository topology at 75 Vitest files / 306 tests and 26 Playwright specs / 129 tests unless a genuinely new test is unavoidable.
- PR #59 must not merge to `master` before owner Manual Visual Acceptance.

---

## File Structure

**Production composition**

- `apps/game/src/ui/shell/bottom-nav.ts` — canonical five-item mobile primary navigation.
- `apps/game/src/ui/shell/player-shell.ts` — shell composition and category-toggle state machine.
- `apps/game/src/ui/shell/simulation-controls.ts` — direct four-speed selector + paused-only Step.
- `apps/game/src/ui/shell/game-hud.ts` — compact three-group HUD carrying Population/Treasury/Net/RCI/Time.
- `apps/game/src/ui/shell/status-feedback.ts` — converted from transient banner into contextual projection-driven sheet while preserving host/status/Undo adapter methods.
- `apps/game/src/ui/shell/tool-context-sheet.ts` — stable compatibility export for the context bridge.
- `apps/game/src/ui/city-ui-runtime.ts` — City management entry and current projection wiring.
- `apps/game/src/ui/systems/city-system-dialogs.ts` — City root receives secondary Information Views / Game Menu entries through callbacks supplied by runtime.
- `apps/game/src/ui/m6-3-figma.css` — single M6.3 Figma-authoritative mobile presentation layer.
- `apps/game/src/main.ts` — remove any now-obsolete shell assumptions only if required by compilation; no runtime semantics change.

**Retired M6.2 presentation-only modules**

- `apps/game/src/ui/shell/primary-actions.ts` — remove after no production/test consumer remains.
- `apps/game/src/ui/shell/build-category-dock.ts` — remove after no production/test consumer remains.
- `apps/game/src/ui/m6-2-mobile.css` — superseded by M6.3 CSS and removed from import path.

**Tests repurposed in place**

- `apps/game/src/ui/shell/bottom-nav.test.ts`
- `apps/game/src/ui/shell/player-shell.test.ts`
- `apps/game/src/ui/shell/player-shell-wiring.test.ts`
- `apps/game/src/ui/shell/game-hud.test.ts`
- `apps/game/src/ui/shell/simulation-controls.test.ts`
- `apps/game/src/ui/shell/tool-context-sheet.test.ts`
- existing City/dialog tests as needed
- existing browser specs/helpers as needed, preserving 129 browser tests

---

### Task 1: Canonical Figma Bottom Navigation

**Files:**
- Modify: `apps/game/src/ui/shell/bottom-nav.test.ts`
- Modify: `apps/game/src/ui/shell/bottom-nav.ts`
- Modify: `apps/game/src/ui/shell/player-shell.test.ts`
- Modify: `apps/game/src/ui/shell/player-shell-wiring.test.ts`
- Modify: `apps/game/src/ui/shell/player-shell.ts`
- Delete after GREEN: `apps/game/src/ui/shell/primary-actions.ts`
- Delete after GREEN: `apps/game/src/ui/shell/build-category-dock.ts`

**Interfaces:**

```ts
export type BottomNavCategory = 'terrain' | 'roads' | 'zones' | 'buildings' | 'city';

export interface BottomNavCallbacks {
  readonly onSelectBuildCategory: (category: 'terrain' | 'roads' | 'zones' | 'buildings') => void;
  readonly onClearBuildCategory: () => void;
  readonly onCity: () => void;
}

export interface BottomNav {
  readonly element: HTMLElement;
  setActiveCategory(category: 'terrain' | 'roads' | 'zones' | 'buildings' | null): void;
  dispose(): void;
}
```

- [ ] **Step 1: Rewrite `bottom-nav.test.ts` RED contract**

Require exactly five persistent items in order:

```ts
expect(
  Array.from(nav.element.querySelectorAll('[data-nav-category]'), node => node.getAttribute('data-nav-category')),
).toEqual(['terrain', 'roads', 'zones', 'buildings', 'city']);
expect(nav.element.textContent).not.toContain('Navigate');
expect(nav.element.textContent).not.toContain('Close');
```

Also prove active-category toggle calls `onClearBuildCategory()` and City calls `onCity()` without selecting a build category.

- [ ] **Step 2: Rewrite `player-shell.test.ts` RED contract**

Require `.city-bottom-nav` to be persistent; require `build-cta`, `primary-navigate`, and `build-category-dock` to be absent. Clicking Terrain must open Terrain subtools and select `raise`; clicking Terrain again must close subtools and select `navigate`.

- [ ] **Step 3: Run targeted RED**

```bash
pnpm --filter @web-three-city/game test -- bottom-nav.test.ts player-shell.test.ts player-shell-wiring.test.ts
```

Expected: FAIL because M6.2 still mounts Primary Actions + Build Category Dock and legacy `bottom-nav.ts` still contains Navigate.

- [ ] **Step 4: Implement canonical bottom nav**

Make `bottom-nav.ts` own the five Figma primary items. `Buildings` data category is presented as label `Build`; `City` has no world-tool mapping.

- [ ] **Step 5: Recompose `player-shell.ts`**

State model:

```ts
let activeCategory: TrayCategory | null = null;

selectCategory(category):
  if (activeCategory === category) {
    activeCategory = null;
    bottomNav.setActiveCategory(null);
    subToolTray.close();
    toolContextSheet.update(navigateProjectionOrHideViaRuntime);
    callbacks.selectTool('navigate');
    return;
  }
  activeCategory = category;
  bottomNav.setActiveCategory(category);
  subToolTray.open(category);
  callbacks.selectTool(defaultToolForCategory[category]);
```

City callback opens management and leaves `activeCategory` and world tool unchanged.

- [ ] **Step 6: Delete obsolete M6.2 composition modules after all imports are gone**

Remove `primary-actions.ts` and `build-category-dock.ts`. Do not leave hidden DOM compatibility shims.

- [ ] **Step 7: Run targeted GREEN and commit**

```bash
pnpm --filter @web-three-city/game test -- bottom-nav.test.ts player-shell.test.ts player-shell-wiring.test.ts
```

Expected: PASS.

---

### Task 2: Restore Complete Figma Compact HUD

**Files:**
- Modify: `apps/game/src/ui/shell/game-hud.test.ts`
- Modify: `apps/game/src/ui/shell/game-hud.ts`
- Verify: `apps/game/src/ui/city-ui-runtime.ts`

**Interfaces:** `GameHudProjection` stays source-compatible with existing runtime projection.

- [ ] **Step 1: Rewrite HUD tests to RED**

Require persistent semantic values:

```ts
for (const metric of ['population', 'treasury', 'net', 'demand', 'gameTime']) {
  expect(hud.element.querySelector(`[data-metric="${metric}"]`)).not.toBeNull();
}
```

Require three visual groups:

```ts
expect(hud.element.querySelectorAll('.city-mobile-hud-group')).toHaveLength(3);
```

Require combined city-values group to contain Population/Treasury/Net, a dedicated RCI group, and Time group.

- [ ] **Step 2: Run HUD RED**

Expected: FAIL because M6.2 persistent HUD contains only Population/Treasury/GameTime.

- [ ] **Step 3: Implement three compact HUD groups**

Keep callback routing by existing metric IDs. A tap on combined group may emit `population` (City Overview), RCI emits `demand`, Time emits `gameTime`.

- [ ] **Step 4: Run HUD GREEN and commit**

---

### Task 3: Direct Figma Simulation Controls

**Files:**
- Modify: `apps/game/src/ui/shell/simulation-controls.test.ts`
- Modify: `apps/game/src/ui/shell/simulation-controls.ts`
- Modify: `apps/game/src/ui/shell/player-shell.ts`

**Interfaces:**

```ts
export interface SimulationControls {
  readonly element: HTMLElement;
  setSpeed(speed: SimulationSpeed): void;
  dispose(): void;
}
```

The component emits existing `callbacks.setSpeed(speed)` and `callbacks.step()` only.

- [ ] **Step 1: Rewrite simulation test RED**

Require four buttons simultaneously:

```ts
expect(
  Array.from(controls.querySelectorAll('[data-simulation-speed]'), b => b.getAttribute('data-simulation-speed')),
).toEqual(['paused', 'normal', 'fast', 'faster']);
```

Each direct button calls the exact speed. Step exists only when paused.

- [ ] **Step 2: Run RED**

Expected: FAIL because current component exposes one cycling toggle.

- [ ] **Step 3: Implement direct selector**

Render Pause, Play, 2×, 4× as direct controls with `aria-pressed`. Provide `setSpeed()` so presentation can truthfully synchronize if runtime speed changes through load/test APIs later.

- [ ] **Step 4: Mount controls in bottom chrome**

`player-shell.ts` mounts simulation controls inside the bottom-bar composition, not in top actions.

- [ ] **Step 5: Run GREEN and commit**

---

### Task 4: Projection-Driven Collapsible Context Sheet

**Files:**
- Modify: `apps/game/src/ui/shell/tool-context-sheet.test.ts`
- Modify: `apps/game/src/ui/shell/status-feedback.ts`
- Modify: `apps/game/src/ui/shell/tool-context-sheet.ts`
- Verify: `apps/game/src/game-tool-context-bridge.ts`

**Interfaces:** preserve current adapter surface:

```ts
interface ToolContextSheetAdapter extends UiAdapter<ContextualToolProjection> {
  setUndoAvailable(available: boolean): void;
  setStatus(value: string): void;
  clearStatus(): void;
}
```

- [ ] **Step 1: Rewrite tests RED around Figma collapsed/expanded states**

Require:

```ts
sheet.update(activeProjection);
expect(sheet.element.hidden).toBe(false);
expect(sheet.element.dataset.expanded).toBe('false');
expect(sheet.element.textContent).toContain('Build Road');
expect(sheet.element.textContent).toContain('Ready');
```

Click `[data-testid="tool-context-toggle"]`; require expanded metadata and conditional Undo. `navigate` projection hides the sheet. Routine helper copy is not rendered as a permanent paragraph.

- [ ] **Step 2: Run context RED**

Expected: FAIL because current M6.2 component hides Tool-ready projections and has no collapsible header/body.

- [ ] **Step 3: Implement stateful context sheet**

Maintain presentation state only:

```ts
let latestProjection: ContextualToolProjection | null = null;
let expanded = false;
let undoAvailable = false;
let transientStatus = '';
```

`update()` stores authoritative projection. `setStatus()` temporarily overrides status text but never invents tool fields. `clearStatus()` returns presentation to projection status. Navigate hides the component.

- [ ] **Step 4: Render only authoritative metadata**

Expanded body renders requested/effective cells and affordability only when present. Undo is mounted in expanded body and enabled only when `undoAvailable`.

- [ ] **Step 5: Run context GREEN and commit**

---

### Task 5: City as the Single Mobile Management Entry

**Files:**
- Modify: `apps/game/src/ui/city-ui-runtime.ts`
- Modify: `apps/game/src/ui/systems/city-system-dialogs.ts`
- Modify existing City/dialog tests if necessary
- Modify: `apps/game/src/ui/shell/player-shell.ts`

**Interfaces:** extend `CitySystemDialogPorts` with presentation navigation callbacks rather than importing runtime internals:

```ts
readonly openInformationViews: () => void;
readonly openGameMenu: () => void;
```

- [ ] **Step 1: Add/repurpose RED assertions**

Require no `.city-top-actions` in player shell. Require City management root to expose `Information Views` and `Game Menu` actions. Verify opening City does not call `selectTool`.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Move Information Views / Game Menu entry functions into reusable runtime closures**

Keep current dialog renderers and menu actions. Pass them into City system dialogs. Do not duplicate Save/Load/Camera/Quality logic.

- [ ] **Step 4: Add secondary management navigation to City Overview**

At the City root, append a compact `Management` navigation group with Information Views and Game Menu. Existing Economy/Population/Zone/Road navigation remains.

- [ ] **Step 5: Remove persistent mobile top actions from `player-shell.ts`**

Delete no capability; only remove the persistent entry surface.

- [ ] **Step 6: Run targeted tests and commit**

---

### Task 6: Figma Tool-State Semantics and M6.3 CSS Authority

**Files:**
- Modify: `apps/game/src/ui/shell/subtool-tray.ts` only if semantic classes/data attributes are required
- Create: `apps/game/src/ui/m6-3-figma.css`
- Modify: `apps/game/src/style.css` or `apps/game/src/main.ts` CSS import path as currently appropriate
- Remove import / delete: `apps/game/src/ui/m6-2-mobile.css`

- [ ] **Step 1: Add semantic attributes without duplicating tool state**

Zone buttons expose stable semantic classes/data such as:

```text
city-tool-pill--residential
city-tool-pill--commercial
city-tool-pill--industrial
```

Active state remains driven by existing `activeMode` only.

- [ ] **Step 2: Implement Figma-authoritative 414×896 CSS**

Lock:

- top HUD gradient + compact pills
- no floating top-right toolbar
- solid bottom bar
- five nav items with active top marker
- direct sim cluster after divider
- subtool tray immediately above bottom bar
- light inactive pills
- semantic active zone pills
- compact context sheet above tray
- 44px minimum targets
- page overflow containment

- [ ] **Step 3: Remove M6.2 CSS authority**

No duplicate competing M6.2 rule layer remains active.

- [ ] **Step 4: Run `pnpm check` and commit**

---

### Task 7: Browser Contract Migration at 414×896

**Files:**
- Modify existing helpers under `browser-tests/helpers/`
- Modify existing browser specs that select `build-cta`, `primary-navigate`, `build-category-*`, top speed toggle, or top action buttons
- Preserve 26 specs / 129 tests

**Interfaces:** introduce/update one helper for category selection:

```ts
export async function openBuildCategory(
  page: Page,
  category: 'terrain' | 'roads' | 'zones' | 'buildings',
): Promise<void> {
  const item = page.getByTestId(`nav-${category}`);
  if ((await item.getAttribute('aria-pressed')) !== 'true') await item.click();
}
```

Add helper to clear active build category by clicking the active nav item rather than a Navigate button.

- [ ] **Step 1: Migrate high-level mobile shell contracts first**

`city-ui-responsive`, `interaction-conformance`, visual evidence specs must assert:

- Terrain/Roads/Zones/Build/City visible
- no Navigate/Build CTA
- four speed controls visible
- active category toggles closed
- context sheet appears after tool selection and expands

- [ ] **Step 2: Migrate shared setup helpers**

All fixture setup must use the new nav helper so system tests do not know shell implementation details.

- [ ] **Step 3: Migrate City/Game Menu/Information Views access**

Browser helpers reach Game Menu and Information Views through City management, not removed top actions.

- [ ] **Step 4: Run targeted changed browser specs**

Use 414×896 for shell/visual contracts. Keep proven wider fixture viewport for coordinate-heavy domain setup where visual fidelity is not under test.

- [ ] **Step 5: Preserve 129-test topology**

Run deployment/topology gate before full browser.

---

### Task 8: Full Verification, Staging Integration, Exact PR #59 Verification

**Files:**
- Update PR # staging description with RED/GREEN evidence
- Update PR #59 description only after integration and exact-head verification

- [ ] **Step 1: Run staging Lean gate**

```bash
pnpm check
```

Expected: PASS; 75 files / 306 tests.

- [ ] **Step 2: Run staging Full Browser**

Expected: 129/129 PASS using CI worker policy; clean worktree PASS.

- [ ] **Step 3: Use verification-before-completion skill**

Require fresh exact-head evidence, not prior M6.2 evidence.

- [ ] **Step 4: Squash staging PR into `feat/light-theme-mobile-first-shell` with expected-head SHA fence**

Do not merge to master.

- [ ] **Step 5: Trigger Lean + Full Browser on exact PR #59 head**

Require:

```text
Lean CI PASS
Full Browser 129/129 PASS
Working tree is clean
```

- [ ] **Step 6: Update PR #59 body to M6.3 current truth**

Record exact head and run evidence; Manual Visual Acceptance remains PENDING.

- [ ] **Step 7: Stop for Manual Visual Acceptance at 414×896**

Do not merge PR #59 to master until owner says PASS.
