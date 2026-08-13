# M6.1 Compact Contextual Toolbar Remediation

Status: APPROVED for implementation
Date: 2026-08-14
System: City UI
Primary viewport: 390×844 and 414×896

## Goal

Reduce the mobile control stack, fix subtool text/icon contrast, place tool context where it belongs, and move simulation speed out of the bottom stack without changing gameplay/domain authority.

## Locked Product Contracts

1. `.city-ui` remains the only player UI surface. No legacy mount returns.
2. Bottom navigation remains five categories: Navigate, Terrain, Roads, Zones, Buildings.
3. Navigate idle shows no contextual toolbar.
4. Terrain/Roads/Zones/Buildings use one contextual toolbar surface above bottom navigation. Tool Context is the toolbar header; it is not a separate floating card.
5. Terrain contextual toolbar contains the tool strip and 1×1 / 3×3 / 5×5 brush selector. Roads/Zones/Buildings omit brush controls.
6. Subtools use a compact horizontal strip on mobile; overflow scrolls horizontally rather than creating a tall two-column grid.
7. Tool context header contains active tool icon/name, state chip, Undo action, and collapse affordance only when useful. Instructional copy such as “Point at the world to preview this tool” does not consume a permanent row; transient result/rejection/status text may appear below the header.
8. Text/icon contrast is owned by component variants, not by a global inherited button color. Dark inactive tool pills use white icon/text. Active accent tool pills also use white icon/text. Light controls use dark primary or muted secondary text as appropriate.
9. The standalone bottom simulation capsule is removed.
10. Simulation speed moves to the top-right action row next to Information Views / City / Game Menu.
11. Speed control is one toggle cycling `paused → normal → fast → faster → paused`, rendered as `Ⅱ`, `1×`, `2×`, `4×` with an accessible label describing the current and next state.
12. Step is a separate compact action visible only while paused. It disappears at 1×/2×/4×.
13. Existing callbacks and runtime authority remain unchanged: `setSpeed`, `step`, `selectTool`, Undo, Save/Load, Economy, Simulation, Terrain, Roads, Zoning, Buildings.
14. Minimum interactive target remains 44px where the control is a primary standalone touch target; compact toolbar internals may visually compress while preserving accessible hit areas.
15. Primary acceptance is mobile portrait. 844×390 remains landscape compatibility; desktop remains smoke coverage.

## Root Cause — Blank Inactive Tool Pills

`subtool-tray.ts` renders icon and label for every tool. The blank appearance is a CSS cascade conflict: `.city-ui button { color: inherit; }` has higher selector specificity than `.city-tool-pill { color: #ffffff; }`. Inactive pills therefore inherit dark navy text on a dark navy background. The remediation removes global button color authority and makes each component variant own its foreground color.

## Target Mobile Composition

Navigate:

```text
HUD                         Info City Menu Speed [Step if paused]

                 WORLD

Bottom Navigation
```

Active tool:

```text
HUD                         Info City Menu Speed [Step if paused]

                 WORLD

Contextual Toolbar
  [icon] Tool Name     READY   Undo/Collapse
  Tool A | Tool B | Tool C | ...
  1×1 | 3×3 | 5×5          (Terrain only)
  transient status/rejection only when present

Bottom Navigation
```

## Acceptance Criteria

- No blank dark subtool pills.
- Inactive and active tool labels/icons are readable at 390×844 and 414×896.
- No standalone `.city-simulation-controls` surface exists in the world-bottom stack.
- Speed and Step live inside `.city-top-actions`; Step is hidden unless paused.
- Tool Context is physically nested inside the contextual toolbar surface for active categories.
- Navigate closes/hides the entire contextual toolbar.
- Terrain contextual toolbar is materially shorter than the current four-layer stack; Roads/Zones/Buildings are shorter still.
- Existing tool selection, brush selection, speed selection, Step, Undo, status/rejection, dialogs, and keyboard fallback semantics continue to work.
