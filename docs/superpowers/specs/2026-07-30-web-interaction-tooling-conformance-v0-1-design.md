# Web Interaction & Tooling Conformance v0.1 — Design Specification

**Status:** APPROVED  
**Approved:** 2026-07-30  
**Date:** 2026-07-30  
**Repository:** `petechatchawan/web-three-city`  
**Working branch:** `agent/road-network-foundation-v0-1`  
**Repository baseline:** `8b847ad29271334f3abc44e6610b1e0d4a9956a6`  
**Parent milestone:** Road Network Foundation v0.1 / PR #11  
**Audience:** Web Three City maintainers and implementation agents

## 1. Decision

Web Interaction & Tooling Conformance v0.1 completes the product-facing interaction layer that sits above the existing Terrain, Terraform, Water, Road, camera, save/load, and Undo foundations.

The current implementation is a technically functional prototype, but its HUD, Terraform stroke semantics, preview semantics, contextual feedback, and invalid-operation routing do not yet satisfy the accepted product behavior contracts.

This amendment makes Web Three City:

- **desktop-first** rather than mobile-first;
- **map-first** rather than debug-panel-first;
- deterministic and transaction-oriented for both Terraform and Road tools;
- explicit about tool ownership, cancellation, invalidity, and Undo;
- visually honest about accepted, propagated, rejected, and no-change Terraform effects;
- accessible without relying on green/red color alone;
- responsive on narrow viewports without making mobile optimization a merge-blocking product goal.

This amendment preserves the existing Road and Terrain package architecture. It does not redesign authoritative Road state, Road connectivity, save formats, Terrain lattice ownership, Water ownership, or chunk invalidation policy.

## 2. Normative inputs and precedence

The repository implementation must be self-contained, but this specification incorporates the accepted product decisions from the following Notion documents:

1. **World Interaction & Terraforming — UX/UI Specification v0.2**  
   Notion page ID: `39fb8aa61030816c938df136fb6556b0`
2. **Terrain Terraform Behavior Specification v0.2**  
   Notion page ID: `3a3b8aa61030814a856afd3f6b498cf1`
3. **Road Network Foundation — System Specification v0.1**  
   Notion page ID: `3aab8aa61030810a933cc2ee5fe70299`
4. **Road Network Foundation v0.1 — Web Three City Design Specification**  
   Repository path: `docs/superpowers/specs/2026-07-29-road-network-foundation-v0-1-design.md`

Precedence is:

```text
this Web-specific amendment
→ accepted Terraform behavior contract
→ accepted Road system contract
→ existing implementation where not contradicted
```

This amendment intentionally overrides only the platform-priority and HUD-layout assumptions inherited from the Unity mobile-first specification. All deterministic behavior, transaction, preview honesty, cancellation, failure, and Undo requirements remain normative.

## 3. Product priority

### 3.1 Primary platform

Web Three City is desktop-first.

Primary acceptance viewport:

```text
1440 × 900 CSS pixels
Desktop Chrome / Chromium
mouse + keyboard
```

The desktop experience may use a floating or pinned panel on the left or lower-left, provided the map remains dominant and primary world operations are immediately understandable.

### 3.2 Responsive compatibility

Narrow viewports remain supported as responsive compatibility.

Reference smoke viewport:

```text
390 × 844 CSS pixels
Chromium device emulation
```

Responsive compatibility requires:

- no clipped controls;
- no horizontal overflow;
- no inaccessible primary tool action;
- no world input leaking through UI controls;
- no runtime exception;
- camera, Terraform, and Road tools remain operable at a basic level.

Responsive compatibility does **not** require:

- bottom-centre mobile tool-dock parity with Unity;
- one-thumb optimization;
- Android physical-device acceptance as a merge gate;
- notch and gesture-navigation certification;
- mobile-first information architecture;
- 56 dp controls on desktop.

For coarse-pointer or narrow-viewport layouts, interactive primary controls must have a minimum effective target size of 44 CSS pixels. Desktop fine-pointer controls may retain compact dimensions when keyboard focus and pointer accuracy remain acceptable.

## 4. Goals

1. Preserve the existing Terrain, Water, Road, save/load, and Undo architecture.
2. Introduce an explicit application-owned Terraform stroke session with per-stamp acceptance semantics.
3. Preserve accepted Terraform stamps when a later stamp is invalid.
4. Represent accepted core, propagated support, rejected current stamp, no-change, and projected water states independently.
5. Prevent Terraform plans blocked by Road occupancy from reaching the Terraform commit callback.
6. Provide explicit user-facing failure reasons without internal diagnostic leakage.
7. Separate primary world tools from secondary controls and diagnostics.
8. Add explicit close/cancel behavior that returns to Navigate mode.
9. Make Road and Terraform invalid previews understandable without color alone.
10. Establish deterministic unit, DOM, WebGL, and browser acceptance gates.
11. Keep PR #11 unmerged until this amendment and the existing dependency/build gates pass.

## 5. Non-goals

This amendment does not add:

- new Terrain tools beyond Raise, Lower, and Flatten;
- new Terraform brush sizes beyond `1×1`, `3×3`, and `5×5`;
- direct Water or Canal editing;
- Road traffic, vehicles, routing, economy, zoning, or buildings;
- bridges, tunnels, diagonal Roads, curved Roads, or Road elevation systems;
- a global command framework beyond the existing latest-world-change Undo abstraction;
- final production art;
- a complete mobile application shell;
- localization delivery, though UI structure must not prevent later localization;
- telemetry or analytics;
- unrelated camera architecture refactoring;
- a generic cross-domain buildability framework.

## 6. Existing architecture retained

The following existing boundaries remain authoritative:

```text
world-core
├── terrain-core
├── water-core
├── road-core
├── terrain-three
├── water-three
└── road-three

apps/game
└── composes authoritative state, application transactions,
    presentation, input, HUD, save/load, and Undo
```

Locked dependency rules:

- `terrain-core` does not import Roads.
- `water-core` does not import Roads.
- `road-core` does not mutate Terrain or Water.
- Three.js packages do not own authoritative world state.
- UI event handlers emit intents and do not mutate domain snapshots directly.
- Cross-domain Terraform/Road policy remains in Game application integration.

## 7. Product surface architecture

The current monolithic control panel is decomposed conceptually into five surfaces. These may be implemented in one DOM root, but ownership and test identifiers must remain distinct.

```text
Game HUD
├── Primary World Tool Dock
├── Tool Context Panel
├── Undo Action
├── Secondary Controls
└── Status / Recovery Feedback
```

### 7.1 Primary World Tool Dock

Contains only primary world modes:

- Navigate;
- Raise;
- Lower;
- Flatten;
- Build Road;
- Bulldoze Road;
- Close Tool.

Behavior:

- selecting a tool activates it immediately;
- selecting another tool cancels any uncommitted session before switching;
- Close Tool clears any uncommitted session and returns to Navigate;
- active state uses text/icon plus selected styling;
- active state does not rely on color alone;
- Terraform brush selection remains visible only for Terraform tools;
- the selected Terraform brush persists while switching among Raise, Lower, and Flatten;
- Road tools do not reset the stored Terraform brush.

### 7.2 Tool Context Panel

The context panel presents current operation information. It is not a developer diagnostic panel.

Minimum content by mode:

**Navigate**

- concise camera interaction hint;
- selected cell when meaningful.

**Terraform**

- active operation;
- brush size;
- Flatten target level when active;
- accepted stamp count;
- affected core cell count;
- propagated support cell count;
- current state: valid, rejected, no change, calculating, committing, or blocked;
- highest-priority user-facing reason.

**Road**

- Build or Bulldoze operation;
- requested path cell count;
- effective mutation cell count;
- valid, invalid, no-change, or committing state;
- highest-priority user-facing reason.

The panel must not expose:

- raw vertex coordinates;
- revision numbers;
- hashes;
- chunk coordinates;
- propagation limits;
- internal exception strings;
- mesh counts;
- test mode labels.

### 7.3 Undo Action

Undo remains visible or immediately reachable.

Rules:

- enabled only when the latest world change can be safely reversed;
- disabled while a transaction is committing or Undo is running;
- one accepted Terraform release creates one Undo record;
- one accepted Road release creates one Undo record;
- rejected, cancelled, stale, and no-change operations do not replace Undo history;
- success feedback is concise;
- failure feedback is blocking only when world consistency cannot be proven.

### 7.4 Secondary Controls

Secondary controls include:

- Save world;
- Load world;
- Quality;
- Grid;
- Rotate left;
- Rotate right;
- Reset camera.

They may remain in a collapsible panel, secondary toolbar, or settings/details section. They must not visually compete with the active world tool.

### 7.5 Status and recovery feedback

Feedback uses three levels:

1. **inline context** for current preview state and repeated invalid samples;
2. **transient status/toast** for release success or recoverable release failure;
3. **blocking recovery** only when authoritative consistency is uncertain.

Repeated invalid pointer samples do not spam transient messages.

## 8. Tool and interaction state model

The Game application owns one immutable presentation state derived from authoritative world state and active interaction sessions.

```ts
interface GameToolPresentationState {
  readonly mode: GameToolMode;
  readonly storedTerraformBrush: 1 | 3 | 5;
  readonly interaction:
    | { readonly kind: 'idle' }
    | TerraformToolPresentationState
    | RoadToolPresentationState
    | { readonly kind: 'committing'; readonly domain: 'terraform' | 'road' }
    | { readonly kind: 'undoing' }
    | { readonly kind: 'blocking-recovery'; readonly message: string };
  readonly undoAvailable: boolean;
  readonly primaryMessage: string | null;
}
```

The UI consumes state and emits intents only:

```text
SelectTool
SelectTerraformBrush
CloseTool
RequestUndo
SaveWorld
LoadWorld
SetQuality
ToggleGrid
RotateCamera
ResetCamera
```

## 9. Pointer ownership

### 9.1 Navigate mode

- primary drag pans the camera;
- wheel zoom remains available;
- configured rotate controls remain available;
- terrain tap may update selection but does not mutate the world;
- UI-originated pointers do not reach world interaction.

### 9.2 Active Terraform tool

- primary pointer-down on valid Terrain starts a Terraform session;
- pointer movement traverses every crossed anchor cell without gaps;
- each unique traversed anchor proposes one tentative brush stamp;
- accepted stamps accumulate;
- an invalid or no-change tentative stamp does not erase earlier accepted stamps;
- pointer-up commits the complete accepted candidate once;
- pointer-up with no accepted effective change commits nothing;
- right-click or `Escape` cancels an uncommitted session;
- pointer cancellation, blur, visibility loss, context loss, disposal, or tool change cancels the session;
- a second pointer cancels the Terraform session before camera gesture ownership is transferred;
- middle drag or the existing camera modifier may pan without creating Terraform changes.

### 9.3 Active Road tool

Road interaction retains atomic whole-command semantics from Road Network Foundation v0.1:

- primary pointer-down starts a Road path;
- pointer movement creates a deterministic cardinally connected path;
- preview represents the complete final command;
- pointer-up commits once when valid and effective;
- any invalid required cell rejects the complete Road command;
- cancellation commits nothing;
- no-change does not replace Undo history.

Terraform uses per-stamp isolation inside one final transaction. Roads use whole-command atomicity. These semantics are intentionally different and must not be forced into one generic stroke abstraction.

## 10. Terraform stroke session

### 10.1 Ownership

A new Game-application unit, conceptually `TerraformStrokeSession`, owns transient Terraform interaction state.

It depends on pure planning contracts and does not mutate Terrain, Water, Roads, or presentation directly.

Responsibilities:

- capture immutable source Terrain and Road snapshots at pointer-down;
- lock the Flatten target from the initial Terrain hit;
- traverse crossed anchor cells deterministically;
- deduplicate anchors;
- tentatively evaluate one new brush stamp at a time;
- retain accepted stamps;
- retain current rejected or no-change stamp separately;
- derive immutable presentation state;
- produce one final guarded commit candidate on release;
- clear all transient state on cancellation.

### 10.2 Session state

```ts
interface TerraformStrokeSessionState {
  readonly lifecycle: 'previewing' | 'ready-to-release';
  readonly operation: 'raise' | 'lower' | 'flatten';
  readonly brushSize: 1 | 3 | 5;
  readonly sourceTerrainRevision: number;
  readonly sourceRoadRevision: number;
  readonly flattenTargetLevel: number | null;
  readonly acceptedAnchors: readonly CellCoord[];
  readonly acceptedPlan: TerraformPlan | null;
  readonly currentStamp:
    | { readonly kind: 'none' }
    | { readonly kind: 'accepted'; readonly anchor: CellCoord }
    | {
        readonly kind: 'rejected';
        readonly anchor: CellCoord;
        readonly reason: GameTerraformInvalidReason;
      }
    | { readonly kind: 'no-change'; readonly anchor: CellCoord };
}
```

Collections are immutable at API boundaries and use deterministic coordinate ordering where order is not semantically path-based.

### 10.3 Tentative stamp algorithm

For each unique traversed anchor:

```text
accepted anchors from immutable source baseline
+ one tentative anchor
→ build complete candidate plan
→ apply Road occupancy guard to the complete final affected-cell set
→ classify candidate as accepted, rejected, or no-change
```

If accepted:

- replace `acceptedAnchors` with the merged anchor list;
- replace `acceptedPlan` with the complete accepted candidate;
- mark current stamp accepted.

If rejected:

- preserve previous `acceptedAnchors` and `acceptedPlan` exactly;
- record the rejected anchor and reason separately;
- do not partially accept cells inside the stamp.

If no-change:

- preserve previous accepted state;
- record a neutral no-change stamp;
- do not treat the stamp as destructive invalidity.

Revisiting an already accepted anchor does not compound height and does not create a second accepted stamp.

### 10.4 Immutable baseline and one-step rule

All accepted candidates are replanned from the Terrain snapshot captured at pointer-down.

- Raise changes each unique affected point at most one level from baseline.
- Lower changes each unique affected point at most one level from baseline.
- Flatten moves each unique affected point at most one level toward the locked target.
- overlapping stamps and revisited anchors never apply a second level during the same session.

### 10.5 Release

On pointer-up:

1. include the final hit anchor when valid;
2. obtain the latest accepted guarded candidate;
3. clear preview/session state from input ownership;
4. if no accepted effective candidate exists, commit nothing;
5. if the latest accepted candidate is Road-blocked or otherwise invalid, commit nothing;
6. send only a valid accepted core plan to the Terraform application transaction;
7. application commit revalidates authoritative revisions and constraints;
8. success creates one Undo record and one feedback event.

An invalid plan must never be sent through a callback that is semantically named or typed as a commit request.

## 11. Terraform and Road guard routing

The existing Road occupancy guard remains in Game application integration.

Required routing contract:

```ts
interface GuardedTerraformCandidate {
  readonly valid: boolean;
  readonly corePlan: TerraformPlan;
  readonly invalidReason: GameTerraformInvalidReason | null;
  readonly blockedRoadCells: readonly CellCoord[];
}
```

Rules:

- preview may display a guarded invalid candidate;
- commit callbacks accept only a valid guarded candidate or a valid `TerraformPlan` obtained from one;
- `terraform:road-occupied` never enters the Terraform mutation function;
- a blocked release produces no Terrain revision, no Water publication, and no Undo record;
- blocked Road cells are available to presentation without exposing Road internals;
- user-facing feedback maps the reason to a stable message such as `Remove the road before changing this terrain`.

## 12. Preview contract

### 12.1 Required simultaneous concepts

Terraform preview must represent these concepts independently:

1. **Accepted core footprint**  
   Cells intentionally selected by accepted brush stamps.
2. **Automatic support propagation**  
   Cells changed outside the selected brush to preserve canonical Terrain continuity.
3. **Current rejected stamp**  
   The most recent tentative stamp that could not join the accepted candidate.
4. **No-change stamp or area**  
   Terrain already at the relevant outcome.
5. **Projected Water and shoreline outcome**  
   Wet, dry, newly exposed, newly flooded, or shoreline-changed classification when available.

The implementation must not collapse the complete preview into one `plan.valid ? green : red` material decision.

### 12.2 Presentation data

Three.js presentation receives an immutable, presentation-oriented model rather than inferring semantic categories from one boolean.

```ts
interface TerraformPreviewSceneModel {
  readonly acceptedCoreCells: readonly ProjectedTerrainCell[];
  readonly propagatedSupportCells: readonly ProjectedTerrainCell[];
  readonly rejectedStampCells: readonly ProjectedTerrainCell[];
  readonly noChangeCells: readonly ProjectedTerrainCell[];
  readonly projectedWetCells: readonly CellCoord[];
  readonly projectedDryCells: readonly CellCoord[];
  readonly projectedShorelineCells: readonly CellCoord[];
  readonly primaryReason: GameTerraformInvalidReason | null;
}
```

`ProjectedTerrainCell` contains enough projected corner information to render against the projected Terrain surface. Presentation does not read mutable Terrain buffers.

When a lower-level planner does not yet expose one category, the application adapter must derive it deterministically from the accepted source and projected plan. It must not fabricate support or water semantics that cannot be proven.

### 12.3 Visual semantics

**Accepted core**

- strongest outline or fill;
- follows projected Terrain geometry;
- remains visible when a later stamp is rejected.

**Propagated support**

- lighter or patterned secondary treatment;
- clearly connected to, but distinct from, core selection;
- fully visible before commit.

**Rejected stamp**

- red/invalid hue plus cross, hatch, border pattern, or warning glyph;
- remains separate from accepted candidate;
- cannot produce commit-success motion.

**No change**

- neutral white/grey or low-emphasis treatment;
- never shown as destructive red.

**Projected water/shoreline**

- subtle overlay or outline;
- does not render final particles or mutate Water presentation before commit.

All preview surfaces:

- follow projected Terrain corner heights;
- use one consistent small surface offset;
- keep depth testing enabled;
- do not use always-on-top x-ray platforms;
- do not float at an unrelated height.

### 12.4 Road preview

Road preview continues to use final Road topology geometry, but invalidity must be distinguishable without color alone.

At minimum:

- valid and invalid materials remain distinct;
- invalid preview adds deterministic border, hatch, cross geometry, or equivalent shape cue;
- context panel displays the stable rejection reason;
- no-change is neutral and does not appear as a destructive error;
- preview is cleared on release, cancellation, tool switch, load, context loss, and disposal.

## 13. User-facing reason catalog

Application code maps stable internal reasons to user-facing messages. UI never displays raw exception strings.

Minimum Terraform mappings:

| Internal reason | Product message |
|---|---|
| out of bounds | `Move the brush inside the map` |
| maximum height | `This terrain is already at maximum height` |
| minimum height | `This terrain is already at minimum height` |
| non-canonical shape | `This change cannot form a supported terrain shape` |
| propagation blocked | `Nearby terrain prevents this change` |
| propagation limit | `This change would affect too much surrounding terrain` |
| Road occupied | `Remove the road before changing this terrain` |
| stale Terrain | `The terrain changed; try again` |
| no effective change | `No terrain change` |
| cancelled | no release error message |

Minimum Road mappings:

| Internal reason | Product message |
|---|---|
| no change | `No road change` |
| out of bounds | `Move the road inside the map` |
| unsupported terrain | `Roads require flat terrain or a supported straight ramp` |
| wet cell | `Roads cannot be placed on water` |
| invalid ramp topology | `Roads on ramps must continue straight along the slope` |
| stale world revision | `The world changed; try again` |

Repeated pointer samples with the same reason update inline context only.

## 14. Keyboard and focus behavior

Desktop convenience bindings:

- `1`: Raise;
- `2`: Lower;
- `3`: Flatten;
- `4`: Build Road;
- `5`: Bulldoze Road;
- `[` and `]`: previous/next Terraform brush;
- `Ctrl+Z` or `Cmd+Z`: Undo latest world change;
- `Escape`: cancel current uncommitted preview; when no preview exists, return to Navigate;
- existing camera keyboard bindings remain unchanged unless they conflict with these locked tool bindings.

Requirements:

- shortcuts do not fire while focus is in an editable or select control when inappropriate;
- focus-visible styling remains clear;
- active state is exposed through `aria-pressed` or an equivalent semantic contract;
- hidden Terraform brush controls are not keyboard-focusable in Road modes;
- closing a tool moves focus to a predictable control without stealing canvas focus during active pointer interaction.

## 15. Responsive layout policy

### 15.1 Desktop

Recommended structure:

```text
left or lower-left floating primary tool area
+ compact adjacent context area
+ secondary controls collapsed or visually separated
```

The exact visual styling is not frozen by this specification. Functional hierarchy and input ownership are frozen.

### 15.2 Narrow viewport

The layout may stack or collapse surfaces.

Required behavior:

- primary world tools remain reachable;
- context content may truncate to the highest-value message;
- secondary controls may collapse behind a disclosure;
- the map retains a usable visible region;
- the panel does not consume the full viewport height by default;
- primary coarse-pointer targets are at least 44 CSS pixels;
- safe-area variables may continue to be honored but physical-device certification is not required.

## 16. Save, load, and session interruption

Save and Load formats are unchanged by this amendment.

Before Load replaces authoritative state:

- cancel active Terraform session;
- cancel active Road session;
- clear all previews;
- disable transaction actions;
- load and validate world state atomically;
- rebuild Terrain, Water, and Road presentation;
- restore Navigate mode unless a later specification explicitly preserves active tools across load.

Save during an uncommitted session saves only authoritative world state. It does not serialize transient previews or active pointer sessions.

Browser visibility loss, WebGL context loss, and disposal clear transient sessions before any rebuild or recovery path.

## 17. Error and consistency handling

### 17.1 Recoverable rejection

Examples:

- invalid stamp;
- Road occupied;
- unsupported Road terrain;
- no change;
- stale revision detected before mutation.

Behavior:

- authoritative world remains unchanged;
- previous Undo remains available;
- preview clears or returns to Tool Ready according to lifecycle;
- concise inline or transient feedback is shown.

### 17.2 Unsafe transaction failure

A failure after authoritative mutation begins but before all dependent world publications and presentations can be proven consistent enters blocking recovery.

Behavior:

- do not report success;
- block new mutation tools;
- retain diagnostic details outside product HUD;
- provide a recovery action such as reload the last saved world or restart the scene;
- automated tests must prove normal rejected paths never enter this state.

## 18. Performance requirements

- fast pointer movement produces gap-free deterministic anchor traversal;
- pointer sampling rate does not change final accepted topology;
- `5×5` Terraform brush preview remains interactive under the existing map size;
- invalid tentative stamps preserve the last confirmed accepted preview without visual teardown flicker;
- preview geometry replacement is staged before replacing the visible root;
- unchanged preview layers are reused where practical;
- Three.js geometries and temporary roots are disposed deterministically;
- steady-state pointer movement must avoid unbounded allocations and retained scene objects;
- browser acceptance checks verify that preview root counts remain bounded across repeated sessions.

Exact frame-time budgets remain evidence-driven and are not invented in this amendment.

## 19. Test identifiers

The following stable identifiers are reserved for browser and DOM acceptance:

```text
[data-testid="primary-world-tools"]
[data-testid="tool-close"]
[data-testid="active-tool"]
[data-testid="terraform-brush-controls"]
[data-testid="tool-context"]
[data-testid="tool-context-state"]
[data-testid="tool-context-message"]
[data-testid="terraform-accepted-count"]
[data-testid="terraform-support-count"]
[data-testid="terraform-flatten-target"]
[data-testid="road-requested-count"]
[data-testid="road-effective-count"]
[data-testid="undo-world-change"]
[data-testid="secondary-controls"]
[data-testid="controls-mode"]
```

Existing accessible names `Save world`, `Load world`, and `Undo latest world change` remain compatible unless intentionally superseded with equivalent stable names and corresponding test updates in the same commit.

Three.js object names used as evidence contracts:

```text
terraform-preview-root
terraform-preview-core
terraform-preview-support
terraform-preview-rejected
terraform-preview-no-change
terraform-preview-water
road-preview-root-valid
road-preview-root-invalid
road-preview-invalid-marker
```

## 20. Testing strategy

### 20.1 Pure unit tests

Add or extend tests for:

- Terraform stamp acceptance after an immutable baseline;
- accepted stamp followed by rejected stamp;
- rejected stamp followed by later valid stamp;
- repeated anchor does not compound;
- fast drag traversal has no gaps;
- no-change classification preserves accepted state;
- Flatten target remains locked;
- Road occupancy guard blocks tentative stamp without erasing earlier accepted candidate;
- release emits no commit request when only rejected/no-change stamps exist;
- release emits exactly one valid commit request for accepted candidate;
- second-pointer cancellation emits no commit;
- Road invalid whole-command behavior remains atomic;
- reason mapping covers every stable reason.

### 20.2 Presentation-model tests

Verify:

- accepted core and support cells are distinct;
- rejected cells are separate from accepted cells;
- no-change cells are neutral;
- projected corner positions are finite and use one consistent offset;
- invalid markers exist independently from color;
- depth testing remains enabled;
- replacing preview disposes old geometry;
- repeated clear/dispose operations are idempotent.

### 20.3 DOM tests

Verify:

- tool selection state;
- explicit Close Tool behavior;
- brush persistence across Terraform tools;
- Terraform brush hidden and disabled in Road modes;
- context values for Terraform and Road sessions;
- raw diagnostics are absent from product context;
- Undo availability transitions;
- secondary controls remain accessible;
- keyboard bindings and focus guards;
- desktop and narrow responsive hierarchy.

### 20.4 Browser/WebGL acceptance

Exact-head browser acceptance must exercise the actual built application, not a source-extracted HTML harness alone.

Desktop scenarios:

1. Navigate without mutation.
2. Select Raise and create an accepted multi-cell stroke.
3. Encounter an invalid later stamp and verify earlier accepted preview remains.
4. Release and verify one Terrain/Undo transaction.
5. Revisit one anchor in a stroke and verify no second level increase.
6. Flatten a ramp and verify target remains locked.
7. Attempt Terraform under a Road and verify no mutation or Undo replacement.
8. Build and Bulldoze Road paths with exact final topology preview.
9. Display accessible invalid Road preview.
10. Save, reload page, Load, and verify Terrain/Road persistence.
11. Cancel with `Escape` and verify no mutation.
12. Verify preview object counts return to zero after completion/cancellation.
13. Verify no page errors or unhandled rejections.

Responsive smoke scenarios at `390 × 844`:

- primary tools reachable;
- controls do not overflow;
- context remains readable;
- secondary controls can be reached;
- UI pointers do not mutate the world;
- one basic Terraform and one basic Road operation complete;
- no browser exception.

Physical mobile-device testing is optional evidence and not a merge blocker for this Web milestone.

## 21. Acceptance matrix

### 21.1 Terraform correctness

- accepted valid stamp remains after a later invalid stamp;
- rejected stamp is not partially accepted;
- a valid stamp may be accepted after a rejected stamp;
- fast pointer traversal visits every crossed anchor;
- revisiting an anchor does not compound;
- each unique affected point changes by at most one level per stroke;
- Flatten target is locked from the initial Terrain hit;
- one release creates at most one Terrain transaction and one Undo record;
- cancellation creates no mutation;
- no-change creates no revision and no Undo entry;
- Road-blocked candidate never reaches Terrain mutation.

### 21.2 Preview honesty

- core, support, rejected, no-change, and projected water categories are independent;
- accepted preview remains visible after current rejection;
- invalidity is not communicated by color alone;
- preview follows projected Terrain surface;
- no floating or x-ray preview plane exists;
- successful commit matches the accepted preview candidate when source revisions remain current.

### 21.3 Road behavior

- Build and Bulldoze remain atomic whole-command operations;
- final topology preview matches committed topology;
- flat and straight one-level ramp policies remain intact;
- invalid Road preview has a non-color cue and user-facing reason;
- rejected/no-change commands do not replace Undo history.

### 21.4 HUD and accessibility

- primary tools are visually distinct from secondary controls;
- Close Tool returns to Navigate;
- active tool and brush are visible;
- context panel reports actionable state without internal diagnostics;
- keyboard and pointer interactions do not conflict;
- fine-pointer desktop and coarse-pointer responsive target policies pass;
- desktop map remains visually dominant;
- narrow viewport has no clipping or horizontal overflow.

### 21.5 Integration

- save/load behavior remains backward compatible with the Road v0.1 save contract;
- load cancels transient sessions;
- Undo works for the latest accepted Terrain or Road command;
- previews clear on tool switch, load, cancellation, context loss, and disposal;
- complete exact-head build and browser suites pass.

## 22. Repository change boundaries

Expected change areas:

```text
apps/game/src/game-input.ts
apps/game/src/game-ui.ts
apps/game/src/style.css
apps/game/src/game-bootstrap.ts
apps/game/src/terraform-road-guard.ts
apps/game/src/road-stroke-controller.ts
apps/game/src/new focused Terraform stroke/session modules
apps/game/src/new presentation-state/reason-mapping modules
packages/terrain-three/src/terraform-preview-*.ts
packages/road-three/src/road-preview-*.ts
browser-tests/*.spec.ts
relevant unit test files
pnpm-lock.yaml generated importer refresh
```

Changes to `terrain-core` are allowed only when a missing pure contract prevents correct stamp isolation or semantic preview derivation. Any such change must remain Terrain-owned, deterministic, and Road-free.

Changes to `road-core` are allowed only when an existing pure plan lacks stable data required for accessible preview or reason reporting. Authoritative Road state and connectivity policy must not be redesigned.

## 23. Implementation sequencing

The implementation plan must sequence work in this order:

1. freeze presentation-state and reason contracts;
2. add Terraform stroke-session unit tests in RED;
3. implement per-stamp isolation without presentation changes;
4. close the Road-guard invalid commit route;
5. introduce semantic Terraform preview model;
6. implement layered Terraform preview presentation;
7. add non-color Road invalid presentation;
8. refactor HUD hierarchy and contextual state;
9. add keyboard/close-tool behavior;
10. expand exact-head browser/WebGL acceptance;
11. run generated lockfile refresh and full verification;
12. update evidence and only then reassess PR #11 merge.

UI restyling must not precede interaction correctness. A visually improved panel is not acceptance if stamp isolation or invalid commit routing remains wrong.

## 24. Verification gates

Required before merge:

```text
pnpm install using repository pnpm 10.13.1
pnpm check
pnpm test:browser
exact-head game build
exact-head Terrain Lab build
exact-head WebGL desktop acceptance
responsive compatibility smoke
pnpm-lock.yaml importer audit
git diff --check
working tree clean
```

The lockfile must be generated by pnpm. Manual reconstruction of integrity-bearing package blocks is prohibited.

A source-exact UI harness may supplement evidence but cannot replace exact-head application/WebGL acceptance.

## 25. Stop conditions

Implementation stops and requests design review when any of these occurs:

- per-stamp isolation requires weakening the immutable-baseline or one-step rule;
- Road-blocked Terraform cannot be rejected before mutation without changing domain boundaries;
- semantic preview requires presentation to inspect mutable authoritative buffers;
- accepted and propagated footprints cannot be derived deterministically from available pure plan data;
- save schema changes become necessary;
- camera architecture must be broadly rewritten;
- Road authoritative state or connectivity must be redesigned;
- pnpm generates broad unexpected package or integrity changes unrelated to workspace importer links;
- exact-head preview and committed world cannot be made identical under current revision fencing.

## 26. Locked decisions

1. Web Three City is desktop-first and map-first.
2. Responsive mobile behavior is compatibility, not the primary product architecture.
3. Existing Road and Terrain package architecture is preserved.
4. Terraform uses per-stamp acceptance inside one release transaction.
5. Roads retain atomic whole-command semantics.
6. Terraform accepted stamps survive later invalid or no-change stamps.
7. All Terraform values derive from one immutable pointer-down baseline.
8. Flatten target is locked from the initial Terrain hit.
9. Road occupancy is evaluated against the complete final Terraform affected-cell set.
10. Road-blocked Terraform never enters the mutation callback.
11. Preview separates core, support, rejected, no-change, and projected water semantics.
12. Invalidity is never color-only.
13. Preview follows projected Terrain with depth testing enabled; floating and x-ray planes are forbidden.
14. Primary tools, contextual feedback, Undo, and secondary controls are separate product responsibilities.
15. Close Tool explicitly returns to Navigate.
16. Internal revisions, hashes, chunk coordinates, and solver limits remain outside product HUD.
17. Save formats remain unchanged.
18. Exact-head WebGL acceptance is required before merge.
19. Physical mobile-device acceptance is not a merge blocker.
20. PR #11 remains unmerged until this amendment and the existing install/build gates pass.

## 27. Implementation permission

This specification authorizes writing a detailed TDD implementation plan after owner review of this file.

It does not authorize production implementation by itself.

Production implementation begins only after:

- owner approves this written specification;
- a repository-readable TDD implementation plan is written and reviewed;
- execution mode is explicitly selected;
- PR #11 status and merge gates are updated to include this amendment.
