# M6.2 — Mobile-Only City UI / Build Dock Design

Date: 2026-08-14
Status: FROZEN FOR IMPLEMENTATION PLANNING
System: City UI
Canonical viewport: **414 × 896 CSS px, portrait**

## 1. Goal

Replace the current always-visible tool-shell composition with a mobile game HUD hierarchy inspired by Pocket City interaction patterns: preserve the world view, keep persistent information compact, and reveal build controls only when the player asks for them.

This is a presentation/composition redesign only. It must not change Terrain, Roads, Zoning, Buildings, Economy, simulation authority, Save/Load semantics, Undo authority, or world interaction semantics.

## 2. Scope Boundary

### In scope

- One canonical mobile portrait layout at **414 × 896**.
- Compact persistent HUD.
- Compact top-right actions including simulation speed toggle.
- Persistent primary bottom actions with a prominent **Build** CTA.
- Build category dock for Terrain / Roads / Zones / Buildings.
- Contextual tool dock for the selected build category.
- Terrain brush controls inside the Terrain contextual dock.
- Transient status / rejection / commit feedback.
- Compact Undo access when Undo is available.
- Existing City, Information Views, Game Menu and management sheets remain accessible.

### Explicitly out of scope for M6.2

- Tablet layout.
- Desktop-specific layout redesign.
- Landscape optimization.
- Breakpoint choreography or responsive rearrangement.
- New gameplay tools or domain behavior.
- Building catalog expansion beyond current product capabilities.

Other viewport sizes only need to remain non-destructive enough for automated compatibility checks; they are not visual acceptance targets for this milestone.

## 3. Canonical Mobile Hierarchy

```text
Tier 1 — World View
  ↓
Persistent compact HUD + top actions
  ↓
Persistent primary bottom actions
  ↓
Tier 2 — Build Category Dock (only while Build is open)
  ↓
Tier 3 — Contextual Tool Dock (only while a build category is selected)
  ↓
Tier 4 — Sheet / catalog only when content volume requires it
```

The world remains the dominant visual surface. Controls must not form a permanent stack of large cards over the map.

## 4. Persistent HUD

The mobile HUD is compact and game-like rather than a row of desktop metric cards.

Primary information:

- Treasury
- Population
- Game time

At 414 × 896 these stay compact enough to preserve the map. Labels may be shortened or visually subordinated; the values remain authoritative and accessible.

Top-right actions remain icon-first:

- Information Views
- City
- Game Menu
- Simulation speed toggle
- Step only while paused

Simulation speed remains:

```text
Paused → 1× → 2× → 4× → Paused
```

`Step` is a command, not a speed state, and is shown only while paused.

## 5. Primary Bottom Actions

The current persistent five-category build navigation is retired for the canonical mobile layout.

Persistent mobile actions are reduced to a small utility group plus a prominent **Build** CTA.

Conceptual structure:

```text
[ Navigate / City / Info utilities ]                     [ BUILD ]
```

The exact utility labels/icons may reuse existing product actions, but Terrain / Roads / Zones / Buildings must no longer occupy the persistent bottom row when Build is closed.

The Build CTA is the primary entry point into construction gameplay.

## 6. Build Category Dock

Pressing **Build** opens a dock immediately above the primary bottom actions.

Categories:

- Terrain
- Roads
- Zones
- Buildings
- Close

The dock uses icon + concise label and explicit selected state. It is optimized for thumb reach and stays compact.

Opening the Build dock does not mutate the world by itself.

Closing Build returns to Navigate unless a product contract explicitly requires preserving a non-build interaction state.

## 7. Contextual Tool Dock

Selecting a category opens one additional compact row/surface above the Build Category Dock.

### Terrain

Tools:

- Raise
- Lower
- Flatten

Brush controls:

- 1×1
- 3×3
- 5×5

The brush row belongs only to Terrain.

### Roads

Tools:

- Build Road
- Bulldoze Road

### Zones

Tools:

- Residential
- Commercial
- Industrial
- Remove Zone

The row may horizontally scroll at 414 px instead of wrapping into a tall 2×2 card.

### Buildings

Current available building actions are exposed compactly. If the product later contains enough building types to require browsing, that future catalog belongs in a sheet rather than expanding the dock vertically.

## 8. Tool Context Retirement

The large persistent Tool Context card is removed from normal mobile interaction.

Do not permanently show text such as:

- `Point at the world to preview this tool`
- `Ready`
- `Undo available`
- `Undo unavailable`

The active tool is already communicated by the selected contextual tool item.

### Status feedback

Only meaningful events create visible feedback:

- rejection / invalid placement
- successful commit
- Undo result
- important blocked state

Feedback is a compact transient banner/chip positioned above the docks and must not permanently reserve map space.

Examples:

```text
Road required
Terraform blocked by Road
Residential Zone placed
Road undone
```

Default idle/ready state produces no persistent status surface.

## 9. Undo

Undo authority does not change.

When Undo is available, expose a small icon action near the transient status/dock area or within the relevant compact control surface. Do not show a permanent `Undo unavailable` control.

Undo remains one world transaction per existing domain contracts.

## 10. Visual Language

- Mobile game HUD, not desktop cards resized smaller.
- World view must remain visually dominant.
- Rounded translucent/raised surfaces are allowed but should be shallow and compact.
- Build CTA receives the strongest visual emphasis in the bottom interaction layer.
- Active category/tool uses the existing accent language consistently.
- Dark controls must own explicit high-contrast foreground colors; no inherited-color ambiguity.
- Touch targets remain at least 44 CSS px where the control is directly interactive.
- Text is secondary to icons in persistent chrome; labels remain available where discoverability requires them.

The Pocket City screenshots are interaction/hierarchy references, not pixel-perfect artwork targets.

## 11. DOM / Architecture Direction

Keep `.city-ui` as the single runtime UI authority established by M1–M6.1.

Recommended presentation composition:

```text
.city-ui
├── .city-awareness-hud
├── .city-top-actions
├── .city-status-feedback          (transient)
├── .city-contextual-tool-dock     (conditional)
├── .city-build-category-dock      (conditional)
├── .city-primary-actions          (persistent)
└── .city-dialog-backdrop / sheets
```

Do not reintroduce the retired legacy game UI mount.

Existing domain callbacks should be rebound to the new presentation components rather than duplicated through mirror state.

## 12. Interaction State Model

```text
NAVIGATE
  └─ Build CTA → BUILD_OPEN

BUILD_OPEN
  ├─ Terrain   → TOOL_ACTIVE(terrain/default tool)
  ├─ Roads     → TOOL_ACTIVE(roads/default tool)
  ├─ Zones     → TOOL_ACTIVE(zones/default tool)
  ├─ Buildings → TOOL_ACTIVE(buildings/default tool)
  └─ Close     → NAVIGATE

TOOL_ACTIVE(category)
  ├─ select subtool → TOOL_ACTIVE(category/subtool)
  ├─ select category → TOOL_ACTIVE(other category/default tool)
  ├─ Close Build → NAVIGATE
  └─ world commit/reject → same TOOL_ACTIVE + transient feedback
```

Dialog opening must continue to preserve the existing active-tool/simulation semantics unless an existing contract says otherwise.

## 13. Acceptance Contract

Primary Manual Visual Acceptance is performed at exactly **414 × 896 portrait**.

Required states:

1. Navigate / Build closed.
2. Build dock open.
3. Terrain active with brush controls.
4. Roads active.
5. Zones active with all four tools reachable.
6. Buildings active.
7. Rejection feedback visible.
8. Successful commit + Undo feedback.
9. City management sheet.
10. Game Menu sheet.

Acceptance criteria:

- No permanent large Tool Context card.
- Build categories are not persistently visible while Build is closed.
- No standalone bottom simulation bar.
- Speed control stays in top actions.
- Map remains the dominant surface.
- No horizontal page overflow at 414 × 896.
- All required build controls remain reachable by touch.
- Active category/tool is visually unambiguous.
- Text/icon contrast remains readable on every active/inactive surface.
- Existing gameplay and persistence contracts remain unchanged.

## 14. Verification Strategy

Implementation must follow TDD.

Automated coverage should assert state/composition contracts rather than pixel-perfect visual snapshots:

- Build closed/open state.
- Build category selection.
- contextual dock contents per category.
- Terrain brush visibility only for Terrain.
- no persistent Tool Context card.
- transient status behavior.
- speed toggle location/semantics.
- active tool preservation around dialogs.
- existing world interaction/browser contracts.

Final gate remains:

```text
pnpm check
→ full browser suite
→ clean-worktree
→ owner manual visual acceptance at 414 × 896
```

PR #59 must remain blocked from `master` until M6.2 manual visual acceptance passes.
