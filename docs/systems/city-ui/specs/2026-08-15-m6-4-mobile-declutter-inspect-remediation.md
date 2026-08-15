# M6.4 Mobile Declutter, Inspect & Interaction Fidelity Remediation

**Status:** FROZEN FOR IMPLEMENTATION  
**Date:** 2026-08-15  
**System:** City UI  
**Canonical acceptance viewport:** 414×896 portrait  
**Secondary mobile viewport:** 390×844 portrait

## 1. Purpose

M6.4 reduces persistent gameplay chrome so the Three.js world is visually dominant, fixes the broken mobile Inspect layout, replaces the compact RCI arrow summary with explicit demand bars, and introduces English/Thai UI locale selection.

This is a **presentation and interaction-orchestration remediation**. It does not move gameplay, Economy, RCI, simulation, Inspect, DialogHost, Save/Load, Undo, Terrain, Road, Zoning, or Building authority into the UI layer.

## 2. Product problem

The M6.3 shell is functionally correct but still consumes too much vertical space during normal play:

- Terrain/Roads/Zones/Build/City are permanently exposed in bottom navigation.
- Category subtool trays remain visible after a tool is selected.
- `city-tool-context-sheet` is too large for information that is usually transient.
- Expanded tool context can duplicate information already represented by the active tool.
- Inspect currently opens through the general 90vh `DialogHost` sheet, producing the wrong layout for a contextual world selection on mobile.
- The RCI arrow summary communicates direction but not demand magnitude clearly enough.
- The shell has no first-class locale selector for English/Thai.

The result is insufficient map visibility and excessive simultaneous chrome.

## 3. M6.4 design principles

1. **World first.** At 414×896, gameplay world area is the primary visual surface.
2. **On demand, not persistent.** Build choices, subtools, Inspect details, and secondary actions appear only when requested.
3. **One active contextual layer.** Build picker, expanded tool options, Inspect detail, and primary dialogs must not stack as competing large surfaces.
4. **Selection closes menus.** Choosing a tool closes the Build picker immediately.
5. **Tool state survives presentation changes.** Opening/closing Build, Inspect, City, or a dialog must not synthesize Navigate, clear Undo history, or mutate simulation speed.
6. **Presentation consumes authority.** Existing domain/application projections remain authoritative.
7. **Mobile-safe interaction.** Interactive targets remain at least 44×44 CSS px and transparent whitespace must never steal world input.

## 4. Bottom gameplay chrome

### 4.1 Persistent entries

The persistent build-category navigation from M6.3 is retired.

The mobile bottom chrome exposes:

- `Build` — single construction/tool entry.
- `City` — management and information entry.
- simulation controls — compact Pause/Play/2×/4× presentation.
- `Step` only while paused.

Terrain, Roads, Zones, and Buildings are no longer permanent bottom-nav tabs.

### 4.2 Build picker

Tapping `Build` opens a lightweight Build picker above the bottom chrome. It is non-modal with respect to the world only where safe, but its own interactive region owns pointer input.

The first level contains four categories:

- Terrain
- Roads
- Zones
- Buildings

Selecting a category reveals only that category's tools. Selecting a concrete tool:

1. invokes the existing typed runtime tool port,
2. closes the Build picker,
3. preserves the selected tool as runtime authority,
4. returns visual priority to the world.

Reopening `Build` while a tool is active may resume at that tool's owning category for fast switching.

### 4.3 Build picker lifecycle

- `Build` toggles the picker.
- selecting a tool closes it,
- `Escape`/Back closes the picker before exiting the active tool,
- opening City or a primary dialog closes the picker,
- opening Build while Inspect is expanded collapses Inspect first,
- no picker transition mutates gameplay/domain state.

## 5. Tool Context remediation

`city-tool-context-sheet` becomes a **compact contextual rail**, not a persistent large sheet.

### 5.1 Default state

When a tool is active and no rejection/transaction detail requires attention, the compact rail shows only:

- active tool name,
- concise state (`Ready`, `Applying`, `Invalid`, or equivalent localized label),
- one compact expand affordance when secondary controls/details exist.

It must not duplicate the entire subtool list.

### 5.2 Expanded state

Expansion is reserved for information/actions that cannot be represented safely elsewhere, for example:

- actionable rejection reason,
- brush/strength options required by the active tool,
- contextual Undo,
- requested/effective cost or metric detail when materially useful.

Undo is a compact action, not a full-width card.

### 5.3 Auto-cleanup

- routine success/help copy must not remain visible after it stops being relevant,
- switching tools removes stale context from the previous tool,
- completing an action may briefly update state but must settle back to the compact active-tool rail,
- no active tool means no persistent tool-context rail unless a transient error/status must still be acknowledged.

## 6. Inspect presentation remediation

### 6.1 Authority boundary

The existing Inspect target resolution and projection remain authoritative:

`world selection → InspectTarget → createInspectProjection(...)`

M6.4 changes presentation only. Inspect must not acquire new gameplay/domain state.

### 6.2 Mobile Inspect surface

Player Inspect no longer uses the generic 90vh primary management sheet as its default mobile presentation.

It uses a dedicated contextual bottom sheet with two visual states:

**Collapsed:**

- target title/type,
- one or two key fields when available,
- Expand,
- Close,
- approximately 72–96 CSS px content height excluding safe-area padding.

**Expanded:**

- reuses the same Inspect surface,
- shows the full existing projection fields,
- consumes no more than approximately 45% of viewport height at 414×896,
- scrolls internally when content exceeds available height.

### 6.3 Inspect lifecycle

- selecting a new target while Inspect is open reuses the same surface and reprojects content,
- no duplicate Inspect panels are created,
- opening Build collapses expanded Inspect,
- opening a primary City/management dialog hides or closes contextual Inspect according to the orchestration contract; it must never stack above the primary dialog,
- closing Inspect closes Inspect only,
- Inspect must not change active tool, simulation speed, Undo, or domain state,
- active build tools continue to own world placement input; Inspect remains a Navigate/default-mode behavior.

### 6.4 Desktop/large viewport

Large viewports may present the same semantic Inspect content with wider sizing, but must preserve one Inspect surface, bounded height, and the same authority/lifecycle contracts.

## 7. RCI demand presentation

The M6.3 RCI directional arrow chip is replaced by explicit `R / C / I` demand bars.

Requirements:

- three visually distinct demand bars,
- each bar represents current magnitude from the existing RCI projection/snapshot,
- zero is visually centered or otherwise unambiguous if the underlying model is signed,
- positive and negative demand remain distinguishable without relying on text arrows,
- compact enough for the awareness HUD,
- the HUD remains glanceable and does not become a large card,
- tapping the RCI metric continues to open the existing Population / RCI management surface.

No RCI calculation or demand authority is changed.

## 8. Localization — English / Thai

M6.4 introduces UI locale support for:

- `en`
- `th`

### 8.1 Locale ownership

City UI owns only the **presentation locale preference**. Domain identifiers and game state remain locale-neutral.

The implementation must provide a single localization access seam instead of scattering `if (locale === ...)` checks through renderers.

### 8.2 Required localized surfaces

At minimum the M6.4 player-facing shell path is localized:

- Build / City entry labels,
- Build categories and tool labels,
- tool-context state/action labels,
- Inspect chrome and Inspect field labels supplied by City UI projections,
- simulation labels/tooltips,
- City shell/menu labels touched by this milestone,
- language menu itself.

Existing domain values, numeric formatting, IDs, and persistence schemas are not translated or changed.

### 8.3 Selector

A compact language selector is exposed from the City/settings/menu path and offers:

- English (`EN`)
- ไทย (`TH`)

Preference may be stored locally as non-authoritative UI preference. Invalid/missing preference falls back deterministically to English.

Thai labels must not introduce horizontal document overflow at the canonical viewport.

## 9. Layering and interaction contract

M6.4 establishes this presentation hierarchy:

```text
Primary Dialog
    > Build Picker / Expanded Inspect
    > Compact Tool Context / Collapsed Inspect
    > Bottom Chrome / HUD
    > World
```

Rules:

- a primary dialog wins over all contextual surfaces,
- Build picker and expanded Inspect cannot remain expanded simultaneously,
- compact Tool Context may coexist with collapsed Inspect only when it does not obscure required controls; otherwise Inspect wins visually,
- invisible/transparent wrappers do not own pointer input,
- only visible interactive controls block world input in their own bounds.

## 10. Back / Escape semantics

For the M6.4 gameplay shell, Back/Escape resolves the topmost presentation layer first:

1. primary dialog internal route/back/close through existing DialogHost semantics,
2. expanded Inspect → collapse,
3. Build picker → close,
4. expanded tool context → collapse,
5. collapsed Inspect → close,
6. active tool exit only through the existing explicit tool-exit contract; M6.4 does not invent a new cancellation authority.

## 11. Responsive and accessibility contracts

- canonical visual acceptance: 414×896 portrait,
- secondary: 390×844 portrait,
- existing landscape and desktop browser coverage remains valid,
- no horizontal document overflow,
- no bottom chrome clipping against safe-area insets,
- 44px minimum interactive targets,
- icon-only controls have stable accessible names,
- focus-visible remains visible,
- reduced-motion remains supported,
- English and Thai both satisfy layout bounds.

## 12. Non-goals

M6.4 does not:

- redesign Economy calculations,
- redesign RCI calculations,
- change Inspect target priority or domain projections beyond localization-safe presentation labels,
- change save schema,
- change simulation authority or time model,
- rewrite DialogHost management navigation,
- create new Terrain/Road/Zoning/Building gameplay commands,
- add additional languages beyond English/Thai,
- introduce a new UI framework.

## 13. Acceptance criteria

M6.4 is acceptable only when all of the following hold:

1. Idle 414×896 visibly exposes more world area than M6.3 because category trays/tool sheets are not permanently consuming vertical space.
2. Only `Build` is the persistent construction entry; Terrain/Roads/Zones/Buildings are on-demand categories inside it.
3. Selecting a concrete tool closes Build UI and leaves only minimal necessary active-tool context.
4. Tool switching within the same category is reachable without exposing unrelated categories permanently.
5. Inspect uses the corrected bounded contextual layout, never the broken 90vh default presentation on mobile.
6. Inspect target changes reuse one surface and never create stacked panels.
7. RCI is represented as readable demand bars rather than directional arrows.
8. EN/TH switching works through one localization seam and both locales fit 414×896 without document overflow.
9. Opening/closing Build, Inspect, City, or dialogs does not mutate gameplay authority, active simulation speed, or Undo history.
10. Existing world pointer-through guarantees remain intact.
11. Targeted RED tests fail for the intended M6.4 contracts before production implementation.
12. Targeted GREEN tests pass after implementation.
13. `pnpm verify:full` passes on the exact candidate head before automated browser acceptance is declared.
14. Owner manual visual acceptance at 414×896 remains the final release gate before the parent shell PR may merge to `master`.
