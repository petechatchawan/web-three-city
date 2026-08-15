# M6.3 — Figma Fidelity Remediation

Status: **FROZEN / APPROVED FOR IMPLEMENTATION**

Date: 2026-08-14

Canonical acceptance viewport: **414 × 896 portrait**

Design authority: user-supplied `City UI Foundation Design.zip`, specifically:

- `src/imports/pasted_text/city-ui-foundation.md`
- `src/components/MobileHUD.tsx`
- `src/components/MobileBottomNav.tsx`
- `src/components/MobileContextSheet.tsx`
- `src/components/SimControls.tsx`
- `src/components/ManagementPanel.tsx`

Production authority remains the current game runtime/domain/application state. Figma is authoritative for player-facing layout, hierarchy, progressive disclosure, and component visual semantics; it is **not** a source of gameplay truth.

## 1. Goal

Cut the current M6.2 shell over to the approved Figma mobile gameplay shell so that the production UI no longer invents a `Navigate + Build CTA` interaction that is absent from the design.

The world remains visually dominant. The shell exposes only essential HUD metrics at the top, primary interaction at the bottom, contextual tools directly above the bottom navigation, and contextual detail through a compact collapsible sheet.

## 2. Scope

M6.3 changes:

- mobile player-shell composition
- compact HUD composition
- bottom navigation
- simulation control presentation
- contextual tool presentation
- contextual sheet presentation and disclosure
- City entry / secondary management navigation
- mobile shell CSS
- unit/browser contracts that encode the old M6.2 composition

M6.3 does **not** redesign:

- Terrain/Road/Zoning/Building domain rules
- tool mutation semantics
- Undo authority
- persistence/save/load authority
- simulation tick model
- Economy calculations
- RCI calculations
- camera gestures
- world rendering
- developer overlay

## 3. Canonical Mobile Shell

At 414 × 896 the normal shell is:

```text
┌────────────────────────────────────┐
│ [👥 Population | 💰 Treasury | Net]│
│                    [R↑ C↑ I→][Time]│
│                                    │
│             GAME WORLD             │
│                                    │
│        [Compact Context Sheet]     │
│        [Contextual Subtool Tray]   │
├────────────────────────────────────┤
│ Terrain Roads Zones Build City │⏸▶2×4×│
└────────────────────────────────────┘
```

There is no persistent Navigate button and no prominent Build CTA.

Navigate/camera mode is implicit when no build category is active. Tapping the currently active build category again clears that category, closes its contextual UI, and selects `navigate` in the existing runtime.

## 4. City HUD

Persistent HUD authority returns to the complete Figma information set:

- Population
- Treasury
- Net / Monthly Net presentation
- RCI demand
- GameTime

Presentation is **three compact groups**, not five full cards:

1. combined Population + Treasury + Net pill
2. RCI pill
3. Time pill

Rules:

- compact numerical formatting may be used for presentation only
- current projection values remain sourced from `GameHudProjection`
- no duplicated Economy/RCI state is introduced
- tapping the RCI group opens Population/RCI management
- tapping the Time group opens Simulation Time
- tapping the combined city-value group opens City management
- construction/active/total remain available to dialogs but are not persistent HUD metrics

## 5. Bottom Navigation

The persistent bottom navigation contains exactly five primary navigation items, in this order:

```text
Terrain | Roads | Zones | Build | City
```

Mapping:

- Terrain → category `terrain`
- Roads → category `roads`
- Zones → category `zones`
- Build → category `buildings`
- City → City management entry, never a world tool

Behavior:

- first tap on a build category selects that category and activates its default production tool
- tapping the active category again clears category/tool presentation and selects runtime `navigate`
- switching categories selects the new category's existing default tool
- City opens management without changing the active world tool
- unrelated contextual tools are never mounted into the active tray

## 6. Contextual Subtools

When a build category is active, show a horizontal tray directly above the bottom bar.

Tool sets remain:

```text
Terrain: Raise | Lower | Flatten
Roads: Build Road | Bulldoze
Zones: Residential | Commercial | Industrial | Remove
Build: Bulldoze Building
```

Terrain additionally exposes the existing 1×1 / 3×3 / 5×5 brush selector.

Visual semantics:

- inactive tools: light neutral surface + secondary/dark text
- active generic tools: accent-dim surface + accent border/text
- Residential active: residential semantic green
- Commercial active: commercial semantic blue
- Industrial active: industrial semantic orange/yellow
- minimum touch target remains 44 px
- horizontal overflow is contained within the tray, never the page

## 7. Contextual Tool Sheet

The current transient-only M6.2 feedback surface is replaced by a compact contextual tool sheet while keeping the same existing tool-context bridge as its data authority.

### Collapsed state

When a world tool is active, show:

```text
Tool Name                  Status
```

and, when authoritative data exists, compact metadata such as affordability/requested/effective cells.

Do **not** fabricate Figma mock values such as hard-coded road cost, terrain cost, or brush size when production does not expose them.

### Expanded state

Tapping the collapsed header toggles an expanded body containing only authoritative fields available from `ContextualToolProjection`, including:

- requested cells when present
- effective cells when present
- affordability when present
- validation/message when meaningful
- Undo action

Undo is enabled only when the existing Undo authority reports availability.

### Feedback behavior

- `Ready` is a legitimate collapsed tool status when a tool is active; it is no longer hidden globally
- routine long helper copy such as `Point at the world to preview this tool` does not consume expanded space by default
- rejection/no-change/invalid messages replace the compact validation line and remain visible while relevant
- host completion messages such as `Road built`, `Zone painted`, `Loaded`, and `Saved` may temporarily override the status line, then return to current tool status
- no second gameplay state authority is introduced

## 8. Simulation Controls

Simulation controls move into the bottom bar, visually after a divider from primary navigation.

Expose four direct controls:

```text
Pause | Play | 2× | 4×
```

Mapping is unchanged:

- Pause → `paused`
- Play → `normal`
- 2× → `fast`
- 4× → `faster`

The currently active speed receives selected accent styling.

`Step` remains available only while paused as a compact adjunct positioned immediately above/adjacent to the simulation cluster so existing deterministic step capability is preserved without expanding the persistent bottom bar.

The control UI must reflect actual simulation speed after interaction. No cycle-only toggle remains.

## 9. City / Secondary Management Entry

Figma mobile shell has no floating Information Views / City / Game Menu top-right toolbar.

Therefore M6.3 removes the persistent top action row from normal mobile gameplay and uses `City` as the single management entry.

The City management root must preserve access to current production capabilities:

- City Overview / current City systems
- Information Views
- Game Menu

These are management/navigation functions, not build tools.

Opening or navigating management does not mutate the current world tool.

## 10. CSS / Visual Contract

`m6-2-mobile.css` is superseded by a single Figma-authoritative mobile presentation module for this shell.

Required visual traits:

- clean light surfaces
- restrained blur
- no dark inactive tool pills
- no large Build CTA
- no floating top-right action stack
- compact pill HUD
- white solid bottom bar
- active navigation indicated by accent color + small top marker
- contextual tray separated from world by subtle top border/shadow
- compact collapsible context sheet with medium rounded corners
- tabular/numeric-style treatment for money/time where existing fonts permit
- minimum interactive target 44 px
- 414 × 896 is the release visual contract; other viewports are compatibility only in this milestone

## 11. State / Authority Invariants

The following invariants are mandatory:

1. `CommittedWorld` remains the source of HUD/Economy/RCI/GameTime values.
2. `GameToolContext` / existing bridge remains the source of contextual tool projection.
3. runtime `selectTool` remains the only world-tool selection authority.
4. simulation runtime remains the only speed/tick authority.
5. Undo remains runtime/application authority.
6. dialogs remain presentation/navigation only.
7. no Figma mock price or validity value may be committed into production without a real production source.
8. no hidden legacy shell is retained solely to satisfy browser tests.

## 12. Test Topology

Preserve repository topology unless a test is genuinely added for new behavior:

- existing Vitest topology: 75 files / 306 tests at M6.2 baseline
- existing Playwright topology: 26 specs / 129 tests at M6.2 baseline

Prefer repurposing existing shell tests rather than increasing topology for presentation-only migration.

## 13. Required Automated Acceptance

Unit/DOM contracts must prove:

- persistent bottom nav is Terrain/Roads/Zones/Build/City
- no Navigate button / Build CTA / build-category dock in normal shell
- category toggle returns to navigate
- HUD contains Population/Treasury/Net/RCI/Time
- simulation exposes four direct speed buttons and paused-only Step
- context sheet is collapsed by default, expandable, and authoritative
- inactive tool pills are not dark presentation-owned controls
- City entry does not change active world tool

Browser contracts must prove at 414 × 896:

- no horizontal overflow
- all five nav items are reachable
- direct simulation controls are reachable
- each category opens its correct contextual tray
- active category toggles closed to Navigate
- Zone tray exposes R/C/I/Remove with semantic selected state
- Terrain exposes Raise/Lower/Flatten + brush sizes
- active tool context sheet is reachable and expandable
- City management preserves world-tool selection
- Information Views and Game Menu remain reachable through City management

## 14. Verification Gate

Before integration into PR #59, exact staging head must pass:

```text
pnpm check
Full Browser 129/129
verify-clean-worktree
```

Then the exact integrated PR #59 head must run the same Lean + Full Browser + clean-worktree gate again.

## 15. Manual Acceptance Gate

After automated verification, stop for owner visual acceptance at **414 × 896**.

Manual review focuses on:

- world dominance
- compact HUD fidelity
- bottom navigation fidelity
- simulation control fidelity
- contextual tray density
- context sheet progressive disclosure
- absence of invented M6.2 Navigate/Build CTA chrome
- no overlap/overflow at 414 × 896

PR #59 remains blocked from `master` until owner Manual Visual Acceptance is PASS.
