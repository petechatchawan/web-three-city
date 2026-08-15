# M6.4 Mobile Declutter — Visual Contracts

**Status:** FROZEN FOR IMPLEMENTATION  
**Date:** 2026-08-15  
**System:** City UI  
**Depends on:** `2026-08-15-m6-4-mobile-declutter-inspect-remediation.md`

These contracts turn the approved M6.4 direction into measurable browser and manual-visual gates. The canonical viewport is **414×896 portrait**; **390×844** is the required secondary mobile check.

## VC-01 — World-first idle shell

At canonical mobile size:

- persistent construction navigation exposes exactly one `Build` entry;
- `Terrain`, `Roads`, `Zones`, and `Buildings` are not persistent bottom navigation items;
- `City` remains a persistent management entry;
- simulation controls remain compact in bottom chrome;
- `Step` is visible/enabled only while paused;
- no subtool tray or tool-context surface is visible while no gameplay tool is active;
- document width never exceeds viewport width.

The persistent bottom chrome must reserve less vertical space than M6.3 by removing the permanently mounted category/subtool layer.

## VC-02 — Build picker root

Tapping `Build` opens one bounded picker above bottom chrome.

- root exposes exactly four category controls: Terrain, Roads, Zones, Buildings;
- every category target is at least 44×44 CSS px;
- the picker is fully contained inside the viewport at 414×896 and 390×844;
- picker content may scroll internally but must not create document horizontal overflow;
- Build is represented as pressed/active while the picker is open;
- no gameplay command is issued by merely opening a category.

## VC-03 — Build category and concrete-tool selection

When a category is selected:

- only tools belonging to that category are shown;
- unrelated category tools are absent from the active tool list;
- selecting a concrete tool invokes the existing runtime `selectTool` port exactly once;
- the picker closes after concrete selection;
- reopening Build resumes the owning category when practical;
- active runtime tool is not reset merely because the picker closes.

Terrain brush controls appear only in the Terrain tool choice/options flow and never as permanent global chrome.

## VC-04 — Compact tool-context rail

For an active tool in its normal ready/applying state:

- the collapsed tool-context rail contains tool identity, concise state, and at most one expand affordance;
- collapsed rail target visual height is **≤72 CSS px** at 414×896, excluding safe-area effects;
- routine helper copy does not consume a second persistent content row;
- full-width Undo cards are prohibited;
- expanded content exists only when there is meaningful validation/detail/Undo or tool-specific secondary information;
- switching mode collapses prior expanded state and removes stale detail.

## VC-05 — Contextual surface exclusivity

At mobile sizes:

- Build picker and expanded Inspect cannot both be expanded;
- a primary DialogHost dialog visually wins over Build/Inspect contextual surfaces;
- opening City/primary management closes Build picker;
- opening Build while Inspect is expanded collapses Inspect first;
- invisible surface wrappers use pointer-transparent behavior so world input is blocked only by visible interactive bounds.

## VC-06 — Inspect collapsed

Player Inspect uses a dedicated contextual surface, not the generic 90vh management sheet.

At 414×896:

- one Inspect surface exists at most;
- default/collapsed surface content height is **72–96 CSS px**, excluding safe-area padding;
- it exposes target identity, compact key information, Expand, and Close;
- controls are ≥44×44 CSS px;
- the world remains visible above it;
- no `.city-dialog-sheet` is created solely for world Inspect.

## VC-07 — Inspect expanded

- expanding reuses the same Inspect root element;
- expanded Inspect is bounded to **max-height: 45vh**;
- overflowing content scrolls inside Inspect;
- selecting a new Inspect target updates the same surface instead of stacking another;
- first Back/Escape on expanded Inspect collapses it rather than closing unrelated state;
- closing Inspect does not mutate active tool, simulation speed, Undo history, or domain state.

## VC-08 — RCI demand bars

The top awareness HUD replaces arrow/direction presentation with three explicit bars.

- exactly three semantic bars exist: Residential, Commercial, Industrial;
- each exposes an accessible label containing sector and demand value;
- magnitude is visualized from the existing signed demand projection;
- signed direction is not communicated by color alone (ARIA/value or visible sign remains available);
- the demand group remains compact and opens the existing RCI/Population management view when activated;
- no RCI calculation changes are permitted.

## VC-09 — Locale contract

Supported presentation locales are exactly `en` and `th` for M6.4.

- one City UI localization seam resolves strings;
- invalid/missing locale falls back to `en`;
- selector exposes `EN` and `TH`/`ไทย` from a compact settings/City path;
- locale change updates shell labels without reload;
- UI preference may be persisted locally but does not enter world/save/domain schemas;
- both locales satisfy VC-01 through VC-08 at 414×896 and 390×844;
- Thai labels must not introduce document horizontal overflow.

## VC-10 — Input and accessibility regression contract

- all new interactive controls meet 44px minimum target size;
- icon-only controls have stable accessible names;
- focus-visible remains visible;
- reduced-motion remains honored;
- HUD/world pointer-through behavior from M6.3 is preserved;
- Build/Inspect surfaces stop pointer propagation only within their visible interactive geometry;
- canvas/world gestures outside contextual surfaces remain reachable.

## VC-11 — Browser evidence states

Automated browser acceptance captures or asserts these canonical states at 414×896:

1. idle shell;
2. Build root picker;
3. Build → Roads category;
4. active Build Road after picker auto-close;
5. Build → Terrain category / tool switching path;
6. Inspect collapsed;
7. Inspect expanded;
8. RCI demand bars;
9. English shell;
10. Thai shell;
11. world pointer-through near HUD/context whitespace;
12. primary City dialog with contextual layers suppressed.

## VC-12 — Manual Figma release gate

Automation proves geometry, lifecycle, accessibility, and regressions. It does **not** approve visual fidelity.

The final release decision is owner review of the exact candidate at 414×896 against the approved Figma direction, specifically checking:

- world/map dominance;
- density and hierarchy of bottom chrome;
- Build picker visual weight;
- compactness of active-tool context;
- Inspect placement and visual weight;
- RCI readability at a glance;
- typography/contrast/spacing in English and Thai.

M6.4 remains release-blocked until that manual acceptance is explicitly recorded.
