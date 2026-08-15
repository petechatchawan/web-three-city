# ADR — Legacy `game-ui.ts` Mount Retirement

**Status:** Accepted

**Date:** 2026-08-10

## Context

The shell/theme milestone (`2026-08-09` ADRs) introduced the `.city-ui` shell as
the primary presentation layer but intentionally left the legacy
`apps/game/src/game-ui.ts` mount in place. That mount still owned the WebGL
canvas host, the dock of tool buttons and mirrors, the game-time HUD, Undo, and
transient status — roughly a 30-member `GameUi` contract consumed by
`bootstrapGame`, plus redundant panel HUDs for RCI and Economy.

The legacy mount was hidden rather than removed, so the runtime mounted two
competing presentation surfaces. Browser specs still located legacy testids and
classes, and the shell could not take ownership of Undo or status because those
feeds had no shell home. The duplication was the root cause of strict-mode
browser failures (e.g. duplicate `tool-context-state` nodes) and blocked a
clean single-shell acceptance suite.

## Decision

Retire the legacy `game-ui.ts` mount entirely. The shell is the only mounted UI
surface.

- **Slim bootstrap adapter.** `bootstrapGame` consumes a narrow
  `GameBootstrapHost` contract that owns only what the shell cannot: the WebGL
  `<canvas id="game-canvas">`, `measureViewport`, the `setStatus` /
  `setUndoAvailable` feeds, and their `onStatus` / `onUndoAvailable`
  subscriptions. The legacy `GameUi` interface and `renderGameUi` are gone;
  `renderGameCanvas` is the adapter entry point.
- **Full retirement, not coexistence.** There is no dual-mount transitional
  mode. Every legacy dock member was either given a shell home or dropped, and
  the mirroring methods (`setToolMode`, `setBrushSize`, `setControlsMode`,
  button reflectors) were removed with their targets.
- **RCI + Economy panel HUDs removed.** `mountRciHud` /
  `mountEconomyBudgetHud` are deleted; their data is rendered by the City
  Overview / Population-RCI / Economy dialogs, which reuse
  `createRciHudModel` / `createEconomyViewProjection`.
- **Undo and status get shell homes.** The tool context sheet gains a clickable
  Undo button (`tool-context-undo`) beside the existing undo-availability pill,
  and a transient status line (`tool-context-status`) consuming the bootstrap
  status feed. A completion status resets an in-flight "Applying change" /
  "Undoing" state to `Ready`, mirroring the retired `game-status`
  MutationObserver.
- **Terraform rejection status restored.** The legacy tool-HUD binding mapped
  terraform `reason` events to status text (`Terraform blocked by building`…).
  That mapping was lost with the binding; `bootstrapGame` now wires
  `onTerraformReject` to the same `statusForTerraformReason` helper used by the
  commit path.
- **Browser specs rewritten.** Every spec locating legacy DOM was rewritten to
  drive the shell (`nav-*`, `data-toolMode`, `tool-context-*`, `data-metric`,
  dialog surfaces). No legacy testid/`data-*`/a11y-name/class locator remains;
  `#game-canvas` is retained for pointer targeting and screenshots.
- **Tool labels are canonical.** The legacy `toolLabel` mapping (`Build Road`,
  `Residential Zone`, `Bulldoze Building`…) is restored as `toolLabel` in
  `game-tool-context-bridge.ts` and shared with the shell tray projections.

## Consequences

### Positive

- One presentation surface with one contract; no hidden legacy DOM.
- `bootstrapGame` no longer knows about buttons, panels, or docks.
- Undo and status are first-class shell surfaces instead of legacy elements.
- Browser acceptance drives the real shell, so suite failures map to the
  shipped UI.
- The composition root (`main.ts`) is explicit about ownership: canvas adapter
  + shell + runtime wiring.
- `style.css` shrinks to the structural base (fonts, sky, canvas); dead legacy
  rules and `growth-time.css` are removed.

### Costs

- Every browser spec had to be migrated in the same effort (spec surface
  changed as the legacy DOM disappeared).
- The bootstrap adapter still owns the canvas and status/undo feeds until the
  shell can own them (no timeline; the contract is stable and narrow).
- `rci-hud.ts` / `economy-budget-hud.ts` keep their model/projection functions;
  the files are smaller but not deleted because the dialogs consume them.

## Rejected alternatives

### Keep the legacy mount hidden behind the shell

Rejected because it duplicates presentation authority, keeps two live DOM
surfaces (including duplicate `tool-context-state` nodes), and forces browser
specs to target a surface that is not what players see.

### Migrate the RCI/Economy panels into the shell as panels

Rejected: the shell design already establishes dialogs as the management
surface, and the dialogs render a verified superset of the panel data. Keeping
panels would reintroduce a permanent sidebar the mobile-first design removed.
