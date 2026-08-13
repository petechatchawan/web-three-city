# Legacy `game-ui.ts` Mount Retirement — Implementation Plan

> **For agentic workers:** Execute inline, one checkbox at a time. Preserve RED
> output in the local command history before writing production code.

**Goal:** Remove the legacy `game-ui.ts` mount from the runtime, replace it with
a slim canvas-only bootstrap adapter, give Undo/status/calendar/building-counts
shell homes, and rewrite every browser spec so the `.city-ui` shell is the only
surface the suite drives.

**Architecture:** `bootstrapGame` consumes a narrow `GameBootstrapHost`
(`canvas` + `measureViewport` + status/undo feeds); `main.ts` composes the
canvas adapter, the shell (`mountCityUi`), and the runtime. Legacy dock, tool
context, secondary controls, game-time UI, and the RCI/Economy panel HUD mounts
are retired; dialogs and the tool context sheet supersede them.

**Tech Stack:** Vanilla TypeScript, native DOM, Three.js presentation adapters,
Vitest + happy-dom, Playwright.

## Global Constraints

- No Save schema change, no domain/core/simulation behavior change, no Undo
  semantic change, no new UI framework runtime.
- Each step keeps unit tests + typecheck green; specs are rewritten in the same
  step as the surface they depend on is removed.
- No `isMobile` branching; browser-signal/camera/grid/quality semantics
  unchanged.

---

## M1 — Slim bootstrap contract + canvas adapter

- [x] RED: typecheck fails while `GameBootstrapHost` still exposes legacy
      members that bootstrap no longer needs.
- [x] GREEN: shrink `GameBootstrapHost` to `canvas` + the method bindings that
      still have targets; keep legacy members on `GameUi`; move dock wiring into a
      `wireLegacyDock` adapter; move RCI/Economy HUD mounts to `main.ts`; extract
      `undoLatest` and expose `runtime.undo()`.
- [x] REFACTOR: delete dead `createGameBootstrapHost` and unused
      `simulationSnapshot`/`rciSnapshot` locals; game typecheck + 318 unit tests.

## M2 — Calendar, building counts, Undo, status into the shell

- [x] RED: `game-hud.ts` lacks calendar/building chips; `tool-context-sheet.ts`
      lacks a clickable Undo and a status line (unit tests fail on the missing
      contracts).
- [x] GREEN:
  - `game-hud.ts` gains `gameTime`, `construction`, `active`, `total` chips
    (`data-metric`), tapping a chip opens the matching City dialog.
  - `tool-context-sheet.ts` gains `tool-context-undo` (wired to `onUndo`,
    enabled via the undo-available signal) and `tool-context-status`
    (bootstrap status feed); undo availability is a separate signal, not part
    of the tool projection.
  - `main.ts` removes `mountGameTimeUi`/`refreshTimeUi`; status/undo feeds are
    bridged into the shell sheet.
- [x] REFACTOR: delete `game-time-ui.ts` + test; game typecheck + 321 unit
      tests.

## M3 — Rebindings to the shell, legacy dock removal

- [x] RED: keyboard/tool bindings still reference legacy `data-action` buttons
      that the retired dock no longer provides.
- [x] GREEN:
  - `game-ui.ts` becomes `renderGameCanvas`: mounts only the canvas in
    `.app-shell`; `GameBootstrapHost` = canvas + `measureViewport` +
    status/undo feeds.
  - `game-bootstrap.ts` drops the `setToolMode`/`setBrushSize`/`setControlsMode`
    and button mirror calls.
  - `main.ts` rewires keyboard shortcuts to the shell tray
    (`[data-toolMode]` / `[data-brush-size]`) with runtime fallbacks; Escape
    navigates through `nav-navigate`; `bindGameToolContext` remains
    shell-facing.
- [x] REFACTOR: delete `game-tool-hud-binding.ts`, `game-secondary-controls.ts`,
      `growth-time.css`, `zoning-tool-ui.test.ts`, and the dead
      `undoTransaction` export; move the preview-state label helpers into the
      bridge. Game typecheck + 305 unit tests.

## M4 — Browser-spec rewrite to the shell

- [x] RED: strict-mode failures from duplicate legacy/shell testids and
      missing legacy locators.
- [x] GREEN:
  - Buffer status/undo feeds in the adapter so a projection arriving before the
    shell mounts is not lost; status line always visible; message testid added.
  - Bulk-replace legacy locators (`game-status` → `tool-context-status`,
    `active-tool` → `tool-context-name`, `rci-population` → `data-metric` +
    dialog rows, `selected-cell` → inspect dialog, `game-calendar` /
    `building-*` → HUD `data-metric` chips, `Undo latest world change` →
    `tool-context-undo`, `road-requested-count` → `tool-context-requested`).
  - Rewrite tray flows that assumed an always-visible dock (open the category
    tray before clicking its tool).
  - Fix dialog row parsing in helpers (`readCityDialog` / `readZoningCounts`)
    to read row `<strong>` values instead of joined text.
- [x] REFACTOR: remove transitional `game-calendar`/`building-*` testids;
      full 129-test Playwright suite green (129/129). The single stale
      `geometrySha256` expectation (water spec) was corrected to match the
      light-theme palette change in `0cee923`; see the verification record.

## M5 — Docs + closure

- [x] README updated to single-shell architecture with the bootstrap adapter.
- [x] ADR `2026-08-10-legacy-game-ui-mount-retirement.md` records the
      retirement decisions and rejected alternatives.
- [x] This TDD record updated.
- [x] Dead panel-HUD code removed: `mountRciHud` / `mountEconomyBudgetHud`
      deleted; their tests slimmed to the retained model/projection functions;
      legacy `.panel`-scoped rules removed from `style.css`.
- [x] `pnpm verify` passes on the exact working tree (format:check, lint,
      typecheck, provenance:check, test:deployment 54/54, workspace tests 306 for
      game, build). The vitest-inventory topology test now parses the JSON array
      from stdout so pnpm engine warnings cannot break it.

## Definition of Done

- No `GameUi` interface member consulted by `apps/game` runtime; `game-ui.ts`
  reduced to the canvas adapter.
- No browser spec references a legacy testid/`data-*`/a11y/class locator.
- RCI + economy panel HUD mount code removed; metrics verified in dialogs.
- Calendar, building counts, status, and Undo function from the shell.
- README + ADR + TDD/verification docs current.
- `pnpm verify` passes; full browser authority passes at closure.
