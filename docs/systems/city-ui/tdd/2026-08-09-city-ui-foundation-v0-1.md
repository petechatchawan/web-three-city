# City UI Foundation v0.1 Implementation Plan

> **For agentic workers:** Execute this plan inline, one checkbox at a time. Preserve the RED output in the local command history before writing production code; do not delegate work because repository policy requires explicit user authorization for subagents.

**Goal:** Replace the permanent gameplay sidebar with a mobile-first player shell, one-primary-dialog management and inspect surfaces, contextual build tools, and real runtime information views without changing domain authority.

**Architecture:** `apps/game/src/ui/city-ui-runtime.ts` composes lifecycle-owned DOM adapters and consumes immutable projections built from `CommittedWorld`. UI actions are typed callbacks into existing commands/tool controllers; `game-bootstrap.ts` only wires ports and publishes committed-world updates. Dialog, inspect, and information-view state are presentation-only and never enter Save V6.

**Tech Stack:** Vanilla TypeScript, native DOM, CSS, Three.js presentation adapters, Vitest + happy-dom, Playwright.

## Global Constraints

- Baseline is planning merge `25769f087c73f3b4040d1dbbdda26067cbea5a89`; Economy Foundation remains closed.
- Do not change Money, Economy settlement/tax semantics, RCI evaluation, Growth, Road/Terrain/Zoning behavior, transaction atomicity, Save V6, GameTime, background-tab policy, or Undo semantics.
- Use semantic DOM, approximately 44 CSS px touch targets, safe-area insets, visible focus, deterministic Back/Escape, and reduced-motion CSS.
- One primary dialog may exist; dialogs block world input but do not alter simulation speed, active tools, previews, strokes, or Undo.
- Only existing canonical grid and zoning rendering may be registered as information views.
- Player UI excludes raw IDs, revisions, fingerprints, and performance/debug state.
- Each production behavior starts with a failing test that fails for the missing behavior, followed by minimal implementation, a green run, and refactoring while green.

---

## Pull-request boundaries

1. `feat/city-ui-shell-dialog-v0-1`: plan, lifecycle/foundation primitives, responsive player shell, HUD, simulation controls, and `DialogHost`.
2. `feat/city-ui-tool-surface-v0-1`: category build dock and contextual Terrain/Road/Zone/Building controls using existing tool callbacks.
3. `feat/city-ui-system-dialogs-v0-1`: registry-backed City Overview, Economy, Population/RCI, Zoning, and Roads projections/dialogs.
4. `feat/city-ui-inspect-information-v0-1`: deterministic committed-world inspect adapters and information-view registry.
5. `feat/city-ui-foundation-v0-1-closure`: legacy removal, responsive/browser regression, docs/verification closure.

Every PR is based on the preceding merged `master`, updates this checklist and `docs/systems/city-ui/README.md` for behavior it introduces, runs owner tests/typecheck and affected browser tags, then runs `pnpm verify` before merge. PR5 runs canonical `pnpm verify:full` on its exact head.

## PR1 — UI Shell and Dialog Foundation

### Task 1: lifecycle and responsive contracts

**Files:**
- Create `apps/game/src/ui/foundation/lifecycle.ts`
- Create `apps/game/src/ui/foundation/responsive.ts`
- Create `apps/game/src/ui/foundation/responsive.test.ts`
- Create `apps/game/src/ui/foundation/tokens.css`

**Interfaces:** `UiAdapter<T> { element; update(T); dispose() }`; `resolveCityUiLayout({width,height}): 'landscape-compact' | 'portrait' | 'desktop'`.

- [ ] RED: table-test widths `844×390`, `390×844`, and `1280×720`; run `pnpm --filter @web-three-city/game test -- responsive.test.ts` and confirm missing-module failure.
- [ ] GREEN: implement the two explicit contracts and token variables for colors, spacing, target size, safe-area, focus, and motion; rerun the focused test.
- [ ] REFACTOR: freeze returned responsive values, remove unused tokens, rerun focused test plus game typecheck.

### Task 2: one-primary-dialog navigation

**Files:**
- Create `apps/game/src/ui/dialog/dialog-navigation.ts`
- Create `apps/game/src/ui/dialog/dialog-navigation.test.ts`
- Create `apps/game/src/ui/dialog/dialog-host.ts`
- Create `apps/game/src/ui/dialog/dialog-host.test.ts`

**Interfaces:** `PrimaryDialogRoute = { kind:'system'|'inspect'; key:string; title:string }`; `DialogHost.open(route, render)`, `push(route, render)`, `back()`, `close()`, `update()`, `dispose()`, `activeRoute`.

- [ ] RED: prove open replaces the existing primary dialog, push/back is LIFO, root Back closes, Close clears the stack, Escape closes, and dispose removes listeners/DOM; run both focused tests and confirm missing behavior.
- [ ] GREEN: implement one semantic `role="dialog"` host with backdrop carrying `data-world-input-block`, Back/Close buttons, one route stack, focus restoration, and no gameplay callbacks.
- [ ] REFACTOR: extract pure stack reducer from DOM host, ensure backdrop pointer events stop propagation, rerun both tests and game typecheck.

### Task 3: compact shell and awareness HUD

**Files:**
- Create `apps/game/src/ui/shell/game-hud.ts`
- Create `apps/game/src/ui/shell/game-hud.test.ts`
- Create `apps/game/src/ui/shell/top-actions.ts`
- Create `apps/game/src/ui/shell/simulation-controls.ts`
- Create `apps/game/src/ui/shell/simulation-controls.test.ts`
- Create `apps/game/src/ui/shell/player-shell.ts`
- Create `apps/game/src/ui/shell/player-shell.test.ts`
- Create `apps/game/src/ui/city-ui.css`

**Interfaces:** `GameHudProjection` contains formatted population, treasury, net, demand labels, and GameTime; simulation callbacks are typed as `setSpeed(GameSpeed)` and `step()`.

- [ ] RED: render/update/dispose tests prove metrics refresh without `aria-live`, top actions are semantic buttons, controls expose Paused/1×/2×/4×/Step, and shell contains no sidebar; run focused files.
- [ ] GREEN: construct DOM with element factories, mount HUD/top actions/simulation controls around the canvas, and implement responsive CSS for all six acceptance viewports.
- [ ] REFACTOR: remove repeated DOM lookup code through a small local `requireElement`, keep component APIs specific, rerun focused tests and game typecheck.

### Task 4: runtime wiring without simulation/tool mutation

**Files:**
- Create `apps/game/src/ui/city-ui-runtime.ts`
- Create `apps/game/src/ui/city-ui-runtime.test.ts`
- Modify `apps/game/src/game-bootstrap.ts`
- Modify `apps/game/src/game-time-ui.ts`
- Modify `apps/game/src/rci-hud.ts`
- Modify `apps/game/src/economy-budget-hud.ts`
- Modify `apps/game/src/style.css`
- Modify `docs/systems/city-ui/README.md`

**Interfaces:** `mountCityUi(root, ports)` accepts projection updates and existing speed/step callbacks; it never receives a domain mutation API except later typed commands.

- [ ] RED: integration test records speed/tool/Undo sentinels, opens/closes City, advances a committed projection, and proves only presentation changes while sentinels remain unchanged.
- [ ] GREEN: wire the new runtime from bootstrap, project existing RCI/Economy/GameTime values into HUD, and mount the empty City system dialog without changing the animation/simulation loop.
- [ ] REFACTOR: move presentation composition out of bootstrap while leaving world transaction and Three.js ownership intact; run focused tests, all game tests, game typecheck, and `pnpm exec playwright test --grep '@interaction|@rci|@smoke'`.

## PR2 — Build and Contextual Tool Migration

### Task 5: build category dock

**Files:**
- Create `apps/game/src/ui/shell/build-dock.ts`
- Create `apps/game/src/ui/shell/build-dock.test.ts`
- Modify `apps/game/src/ui/shell/player-shell.ts`
- Modify `apps/game/src/ui/city-ui-runtime.ts`
- Modify `apps/game/src/game-bootstrap.ts`

**Interfaces:** categories are `terrain|roads|zones|buildings`; leaf buttons emit existing `GameToolMode`; category expansion never emits Navigate.

- [ ] RED: prove category selection reveals only owned tools, selecting leaves emits exact existing modes, closing a palette preserves active mode, and all targets are keyboard/touch buttons.
- [ ] GREEN: mount bottom dock and connect typed callbacks to existing `setToolMode`/`setBrushSize` without synthesizing tool clicks.
- [ ] REFACTOR: consolidate pressed-state rendering and rerun dock, game-tool, input, and keyboard tests.

### Task 6: contextual tool surface

**Files:**
- Create `apps/game/src/ui/tools/contextual-tool-surface.ts`
- Create `apps/game/src/ui/tools/contextual-tool-surface.test.ts`
- Modify `apps/game/src/game-tool-presentation.ts`
- Modify `apps/game/src/game-tool-hud-binding.ts`
- Modify `apps/game/src/ui/city-ui-runtime.ts`
- Modify `apps/game/src/ui/city-ui.css`

**Interfaces:** `ContextualToolProjection` is a discriminated union for navigate/terraform/road/zone/building with quote, validity, rejection, affordability, brush, and Undo fields when authoritative.

- [ ] RED: test each union renderer, affordability text independent of color, Undo availability, and absence of `data-world-input-block` on the surface container.
- [ ] GREEN: map existing tool presentation/economy quote state into the contextual projection and preserve existing buttons/test IDs needed by browser authority.
- [ ] REFACTOR: delete migrated sidebar-only tool DOM and selector wiring; run game tool/controller tests and targeted `@terrain|@road|@zoning|@building|@interaction` browser tests.

## PR3 — City System Dialogs

### Task 7: immutable City projection registry

**Files:**
- Create `apps/game/src/ui/systems/system-registry.ts`
- Create `apps/game/src/ui/systems/system-registry.test.ts`
- Create `apps/game/src/ui/systems/city-projections.ts`
- Create `apps/game/src/ui/systems/city-projections.test.ts`

**Interfaces:** registry keys are `overview|economy|population-rci|zoning|roads`; projections accept only `CommittedWorld` plus existing RCI registries and return frozen player-safe view models.

- [ ] RED: fixture tests assert literal summary, demand/gate, zone counts, road occupied/network count, and Economy line items; mutation attempts cannot alter committed snapshots.
- [ ] GREEN: compose existing `createEconomyViewProjection`, `createRciProjection`, `zoneCounts`, and Road snapshot derivations without new domain arithmetic.
- [ ] REFACTOR: keep per-system projection functions in focused files if any exceeds one responsibility; run projection tests and game typecheck.

### Task 8: system dialog screens and typed Taxation intent

**Files:**
- Create `apps/game/src/ui/systems/city-overview.ts`
- Create `apps/game/src/ui/systems/economy.ts`
- Create `apps/game/src/ui/systems/population-rci.ts`
- Create `apps/game/src/ui/systems/zoning.ts`
- Create `apps/game/src/ui/systems/roads.ts`
- Create `apps/game/src/ui/systems/system-dialogs.test.ts`
- Modify `apps/game/src/ui/city-ui-runtime.ts`
- Modify `apps/game/src/game-bootstrap.ts`
- Modify `apps/game/src/economy-budget-hud.ts`

**Interfaces:** Economy tabs are `overview|taxation`; Taxation submits `EconomyTaxPolicy` through existing `executeEconomyTaxPolicyCommand` and renders bounded status.

- [ ] RED: component tests prove registry navigation, Economy tabs/back, all required line items, policy validation result, dirty draft preservation during background projection refresh, and adapter dispose.
- [ ] GREEN: implement screens and typed command port; committed-world subscriber refreshes the open route while simulation continues.
- [ ] REFACTOR: remove legacy Economy/RCI detailed sidebar mounts after equivalent dialogs exist; run Economy command/HUD/save tests and targeted `@rci|@interaction|@smoke` browser tests.

## PR4 — World Inspect and Information Views

### Task 9: deterministic committed-world picking and inspect projections

**Files:**
- Create `apps/game/src/ui/inspect/inspect-target.ts`
- Create `apps/game/src/ui/inspect/inspect-target.test.ts`
- Create `apps/game/src/ui/inspect/inspect-projections.ts`
- Create `apps/game/src/ui/inspect/inspect-projections.test.ts`
- Modify `apps/game/src/game-input.ts`
- Modify `apps/game/src/game-bootstrap.ts`

**Interfaces:** `pickInspectTarget(world, cell)` returns `building|road|zone|terrain` in strict priority; stable selection uses player-safe cell/footprint identity and is re-resolved on each committed update.

- [ ] RED: overlapping fixtures prove Building > Road > Zone > Terrain; active build mode never calls inspect; removed/replaced targets resolve to `unavailable` rather than cached content.
- [ ] GREEN: add Navigate tap callback after terrain picking and build frozen projections for authoritative fields only.
- [ ] REFACTOR: share bounds/cell helpers without exposing raw IDs/revisions; run inspect and game-input tests.

### Task 10: inspect dialog screens

**Files:**
- Create `apps/game/src/ui/inspect/inspect-dialog.ts`
- Create `apps/game/src/ui/inspect/inspect-dialog.test.ts`
- Modify `apps/game/src/ui/city-ui-runtime.ts`
- Modify `apps/game/src/ui/city-ui.css`

**Interfaces:** one renderer handles four discriminated player projections plus `unavailable`; Back/Close remain host-owned.

- [ ] RED: render literal Building/Road/Zone/Terrain fields, verify unavailable refresh, and scan normal dialog text for prohibited raw revision/fingerprint labels.
- [ ] GREEN: open smaller InspectDialog from Navigate picks and update it from committed-world publications.
- [ ] REFACTOR: keep player adapters separate from existing `interaction-evidence` developer overlay; run focused tests and inspect browser acceptance.

### Task 11: information-view registry

**Files:**
- Create `apps/game/src/ui/information-views/information-view-registry.ts`
- Create `apps/game/src/ui/information-views/information-view-registry.test.ts`
- Create `apps/game/src/ui/information-views/information-view-menu.ts`
- Modify `apps/game/src/ui/city-ui-runtime.ts`
- Modify `apps/game/src/game-bootstrap.ts`

**Interfaces:** `activate(key)`, `replace(key)`, `deactivate()`, `projection()`; adapters call existing grid/zoning visibility ports and return title/legend.

- [ ] RED: test single-active invariant, replace deactivates prior adapter exactly once, repeated deactivate is safe, and registry contains only runtime-backed views.
- [ ] GREEN: register canonical grid and zoning visualization, expose menu and active legend, and preserve active build tool.
- [ ] REFACTOR: centralize overlay visibility ownership and run registry tests plus `@zoning|@interaction` browser tests.

## PR5 — Legacy Removal, Responsive Acceptance, and Closure

### Task 12: clean replacement

**Files:**
- Delete `apps/game/src/game-ui.ts` after callers are migrated
- Delete obsolete sidebar-only tests/adapters where equivalent behavior is covered
- Modify `apps/game/src/style.css`
- Modify `apps/game/src/game-bootstrap.ts`
- Modify `apps/game/src/game-ui.test.ts` into `apps/game/src/ui/city-ui-runtime.test.ts` coverage as needed

- [ ] RED: add an architectural DOM test that mounts runtime and fails if `.panel`, `.game-hud` legacy sidebar, or duplicate authoritative Economy/RCI controls exist.
- [ ] GREEN: remove permanent sidebar markup, unused selectors/listeners/styles, and duplicate presentation mounts while retaining test IDs at their new semantic owners where browser contracts require them.
- [ ] REFACTOR: use `rg` to prove no production reference to deleted adapters/classes and run all game tests/typecheck.

### Task 13: browser acceptance inventory

**Files:**
- Create `browser-tests/city-ui-shell.@interaction@smoke.spec.ts`
- Create `browser-tests/city-ui-dialogs.@rci@interaction.spec.ts`
- Create `browser-tests/city-ui-inspect.@interaction.spec.ts`
- Create `browser-tests/city-ui-information-views.@zoning@interaction.spec.ts`
- Modify existing Economy, Road, Terraform, Zoning, Building, Save/Load specs only for new semantic entry points without weakening assertions.

- [ ] RED: run each new spec against pre-migration behavior and record failures for missing shell/dialog/inspect/information-view contracts.
- [ ] GREEN: cover `844×390`, `932×430`, `390×844`, `430×932`, `1280×720`, `1440×900`; assert no overflow/sidebar, HUD/dock/controls, live Economy refresh/tax/blocking, tool persistence and placement, four inspect targets/unavailable, view replace/deactivate, and Save/Load.
- [ ] REFACTOR: extract only repeated viewport/dialog helpers, retain `retries:0` and `workers:2`, run affected tagged subsets.

### Task 14: exact candidate and closure evidence

**Files:**
- Modify `docs/systems/city-ui/README.md`
- Create `docs/systems/city-ui/verification/2026-08-09-city-ui-foundation-v0-1-closure.md`

- [ ] Update README to implemented behavior; write the closure record with stable acceptance criteria and test inventories, while keeping run IDs and post-merge SHAs in PR-body evidence so the verified repository tree is not mutated afterward.
- [ ] Run `pnpm --filter @web-three-city/game test`, game typecheck, all affected targeted browser tags, then `pnpm verify`; fix root causes with RED regression tests.
- [ ] Run exact-head `pnpm verify:full`, verify exit zero and clean worktree, record candidate commit/tree SHA before any merge.
- [ ] Push PR5, wait for exact-head Lean CI, Full Browser exact Lean artifact consumption, and SonarCloud; record run/job/artifact IDs in PR body/comment.
- [ ] Squash-merge only with all required evidence passing, sync `master`, compare candidate tree to merged tree with `git diff --exit-code <candidate>^{tree} HEAD^{tree}`, and record merge/equality evidence externally without changing the verified tree.
- [ ] Delete merged remote/local feature branches and remove only worktrees created for this milestone.

## Verification commands

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm exec playwright test --grep '@terrain|@road|@zoning|@building|@rci|@interaction|@smoke'
pnpm verify
pnpm verify:full
node tooling/verify-clean-worktree.mjs
```

Browser CI must consume the exact Lean artifact under existing repository workflow authority. No retry, worker, broad timeout, or filter governance changes are permitted for this milestone.
