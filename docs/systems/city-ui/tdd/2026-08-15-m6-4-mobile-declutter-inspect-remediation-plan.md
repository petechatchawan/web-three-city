# M6.4 Mobile Declutter, Inspect & Interaction Fidelity — TDD Implementation Packet

**Status:** APPROVED FOR INLINE EXECUTION  
**Date:** 2026-08-15  
**System:** City UI  
**Spec:** `docs/systems/city-ui/specs/2026-08-15-m6-4-mobile-declutter-inspect-remediation.md`  
**Visual contracts:** `docs/systems/city-ui/specs/2026-08-15-m6-4-mobile-declutter-visual-contracts.md`

## Execution rule

Each implementation batch follows **RED → minimal production GREEN → focused regression**. Production authority is not moved. Browser tests validate user-visible orchestration at 414×896; unit/component tests validate local lifecycle/state contracts.

## Baseline production seams

Primary files expected to change:

- `apps/game/src/ui/shell/player-shell.ts`
- `apps/game/src/ui/shell/bottom-nav.ts`
- `apps/game/src/ui/shell/subtool-tray.ts`
- `apps/game/src/ui/shell/status-feedback.ts`
- `apps/game/src/ui/shell/game-hud.ts`
- `apps/game/src/ui/inspect/inspect-dialog.ts` or a dedicated sibling contextual Inspect surface
- `apps/game/src/ui/city-ui-runtime.ts`
- `apps/game/src/main.ts`
- `apps/game/src/ui/m6-4-mobile-declutter.css` (new, loaded after M6.3)
- a City-UI-owned localization seam under `apps/game/src/ui/`

Existing runtime/domain files remain consumers only unless a typed presentation projection must be extended without changing calculation authority.

Primary existing tests to preserve/extend:

- `apps/game/src/ui/shell/bottom-nav.test.ts`
- `apps/game/src/ui/shell/subtool-tray.test.ts`
- `apps/game/src/ui/shell/player-shell.test.ts`
- `apps/game/src/ui/shell/player-shell-wiring.test.ts`
- `apps/game/src/ui/shell/tool-context-sheet.test.ts`
- `apps/game/src/ui/shell/game-hud.test.ts`
- `apps/game/src/ui/inspect/*test.ts`
- `browser-tests/city-ui-inspect-information.@interaction@building@road@zoning.spec.ts`
- `browser-tests/city-ui-responsive.@interaction@smoke@release.spec.ts`
- existing City UI / economy / interaction smoke suites.

New focused browser acceptance file:

- `browser-tests/city-ui-m6-4-mobile-declutter.@interaction@rci@release.spec.ts`

## Batch 0 — Contract RED harness

### RED tests

Add focused assertions that are false on the M6.3 baseline:

1. bottom nav exposes Build + City rather than four persistent build categories;
2. Build picker is closed initially, opens to four categories, and concrete tool selection auto-closes it;
3. active ready context is ≤72px at 414×896;
4. world Inspect does not create `.city-dialog-sheet`, starts 72–96px tall, expands to ≤45vh, and reuses one surface;
5. HUD exposes three R/C/I demand bars rather than directional arrow text;
6. locale switch EN→TH updates visible shell labels and produces no horizontal overflow;
7. Build and expanded Inspect are mutually exclusive;
8. primary dialog suppresses competing contextual surfaces;
9. HUD/context whitespace still permits world input.

### RED gate

Run only the focused M6.4 browser/component tests. Capture exact fail count and representative failure reasons. Do not edit production code until failures are shown to be contract failures rather than selector/setup errors.

## Batch 1 — Single Build entry + on-demand picker

### Component RED

Update/add tests for:

- `bottom-nav.ts`: persistent entries are Build/City; Build is a toggle action, not a category command;
- `subtool-tray.ts`: supports root-category state and category-tool state; selecting concrete tool emits one mode and closes through caller lifecycle;
- `player-shell.ts`: opening category no longer auto-selects its default tool; concrete tool selection owns runtime selection.

### Production GREEN

- refactor bottom nav to Build + City;
- repurpose/refactor subtool tray into an on-demand Build picker with root/category states;
- keep existing typed `selectTool(GameToolMode)` and brush callback;
- closing picker does not synthesize `navigate`;
- City closes Build picker before opening management;
- reopening Build can resume active tool category.

### Regression

Run shell unit tests plus browser states Idle / Build root / category / concrete tool auto-close.

## Batch 2 — Compact tool context

### RED

- active tool context is hidden for Navigate;
- normal active collapsed state contains no routine helper paragraph;
- collapsed geometry ≤72px at canonical mobile;
- Undo is a compact action only in expanded meaningful state;
- switching tool collapses stale expansion/detail.

### GREEN

- preserve existing `ContextualToolProjection` authority;
- localize labels through the new presentation string seam later without duplicating state;
- trim status rendering and CSS geometry;
- preserve transient rejection/status behavior.

### Regression

Run `tool-context-sheet.test.ts`, player shell tests, affected interaction smoke tests.

## Batch 3 — Dedicated contextual Inspect surface

### Root cause

Current `inspect-dialog.ts` sends world Inspect through generic `DialogHost`; generic `.city-dialog-sheet` intentionally supports management dialogs with `max-height: 90vh`. The bug is presentation-host mismatch, not Inspect projection logic.

### RED

- opening Inspect creates dedicated `.city-inspect-surface`, not `.city-dialog-sheet`;
- collapsed/expanded geometry contracts;
- one surface reused for target changes;
- Build collapses expanded Inspect;
- Close preserves active tool/simulation/Undo;
- Escape first collapses expanded Inspect;
- primary dialog wins over Inspect.

### GREEN

Introduce a dedicated contextual Inspect adapter/host under `apps/game/src/ui/inspect/` that:

- consumes existing `InspectTarget` and `createInspectProjection(...)`;
- renders same semantic fields;
- owns only collapsed/expanded/presentation lifecycle;
- exposes `open/updateTarget`, `collapse`, `close`, `isOpen/isExpanded`, `dispose` (or equivalent typed API);
- integrates through player/runtime orchestration without modifying domain projections.

Do not globally shrink DialogHost.

### Regression

Run Inspect unit/browser tests and dialogs tests.

## Batch 4 — RCI demand bars

### RED

- HUD demand group contains exactly three sector bars;
- accessible values include sector + signed demand;
- old direction-string visual is absent from compact HUD;
- click still routes to existing RCI metric management callback.

### GREEN

Extend `GameHudProjection` with presentation-safe numeric R/C/I demand values or a typed demand object sourced from existing `RciHudModel`. Keep calculation in existing RCI projection/model. Render three compact bars with signed semantic values.

### Regression

Run `rci-hud.test.ts`, `game-hud.test.ts`, RCI browser suites.

## Batch 5 — EN/TH localization seam

### RED

- deterministic English fallback;
- `en` and `th` dictionary keys cover M6.4 shell strings;
- changing locale updates Build/City/category/tool/context/Inspect chrome without reload;
- preference is UI-local only;
- both locale browser states have no horizontal overflow.

### GREEN

Add a City UI localization module with:

- `UiLocale = 'en' | 'th'`;
- complete typed key dictionary for M6.4 surfaces;
- translator `t(key)` and locale subscription/update seam;
- local preference adapter with English fallback;
- compact selector reachable from City/settings path.

Do not place locale into world save/domain state.

### Regression

Run localization unit tests, player shell/system-dialog tests, EN/TH browser states.

## Batch 6 — CSS/layering/pointer hardening

### RED/contract assertions

At 414×896 and 390×844:

- no document horizontal overflow;
- all M6.4 interaction targets ≥44px;
- Build picker + expanded Inspect cannot coexist;
- Inspect expanded ≤45vh;
- compact rail ≤72px;
- bottom safe area remains visible;
- transparent HUD/context wrappers do not steal world pointer input.

### GREEN

Add `m6-4-mobile-declutter.css` as the final City UI presentation override, loaded after M6.3 styles. Prefer removing obsolete M6.3 behaviors in markup/state where possible; use CSS only for visual geometry/layering, not authority.

## Batch 7 — Targeted GREEN browser acceptance

Run focused M6.4 browser suite with one worker first. Required states:

- idle;
- Build root;
- Roads category;
- active Build Road after picker close;
- Terrain switching;
- Inspect collapsed;
- Inspect expanded;
- RCI bars;
- EN;
- TH;
- pointer-through;
- City dialog layer precedence.

Record exact pass count/runtime/candidate SHA.

## Batch 8 — Full verification

On exact candidate HEAD:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm verify:full
```

Required:

- lint/typecheck/unit checks pass;
- full browser suite passes;
- clean working tree check passes where CI enforces it;
- no known release-blocking quality/security gate.

Any failure is diagnosed before claiming completion; do not weaken tests to obtain green unless the assertion is proven inconsistent with the frozen contract.

## Batch 9 — Browser evidence + manual Figma packet

Produce canonical 414×896 evidence for VC-11 states. Automated acceptance can be declared after verification, but final visual fidelity stays blocked on owner comparison with the approved Figma reference.

Manual checklist:

1. city/map visually dominates idle state;
2. Build picker feels temporary/lightweight;
3. selecting a tool clears menu chrome immediately;
4. active tool rail is compact enough during actual placement;
5. Inspect collapsed and expanded layouts feel contextual rather than modal;
6. RCI demand is understandable at a glance;
7. Thai typography fits naturally without crowding;
8. simulation/City controls remain easy to reach;
9. no visual collision or accidental world-input blocking.

## Integration boundary

M6.4 branch: `fix/m6-4-mobile-declutter`  
Integration target: `feat/light-theme-mobile-first-shell`  
Do **not** merge directly to `master` from M6.4. The staging-to-master release remains controlled by the parent shell PR and manual visual acceptance.
