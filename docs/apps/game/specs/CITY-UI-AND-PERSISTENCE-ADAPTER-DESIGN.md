# City UI and Persistence Adapter Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `apps/game`

## Purpose

Define the browser-specific UI and persistence adapters used by city-session orchestration while keeping business sequencing outside the app shell.

## Screen model

```text
Application Navigation
-> typed Screen Controller
-> typed presentation state
-> Screen View

Home
├─ Resume latest save when available
├─ New City
└─ Load City

New City
├─ name + Seed64 + Randomize
├─ Generate exact prepared Terrain
├─ live Three.js preview of that prepared Terrain
├─ accessible starting-Region selection
└─ Create City consumes the same preview object

Load City
├─ lightweight save list
├─ selected save metadata/detail
└─ explicit Load City

Game
├─ live world viewport
├─ compact production HUD
├─ static Tool Dock
├─ Context Surface
├─ Inspector / Dialog / Notification / Debug hosts
└─ centralized command/dismiss routing
```

Views emit semantic intents and own only view-local DOM listeners. Controllers own presentation state and application calls. Navigation is single-flight and deterministically disposes the previous screen/runtime.

## Visual language

Use one app-owned design system: Foundation tokens -> primitives -> components -> patterns -> typed feature views. No React/shadcn runtime is introduced. Visual target is game-first, world-first, compact, and neutral:

```text
subtle 1px borders
compact cards
small radius
muted supporting text
clear primary/secondary hierarchy
accessible focus ring
minimal shadows
44px minimum interactive target
```

No React dependency is introduced.

## Seed randomization

The UI's Randomize button calls an injected browser `SeedSource` implemented with `crypto.getRandomValues()`. Terrain itself remains deterministic and never calls randomness.

## IndexedDB repository

Database/schema names are centralized constants. Store `cities` uses `cityId` as key and indexes `lastPlayedAt` and `updatedAt`.

Operations are Promise-based wrappers around request/transaction events:

```text
list
load
latest
save
remove
```

Writes use one readwrite transaction per complete CitySave record. No save is initiated from unload/pagehide. IndexedDB errors become typed repository failures.

## Data rules

Only structured-clone-compatible plain data crosses the repository boundary. Any save loaded from IndexedDB is validated through the city-session save decoder before system restore.

## Async bootstrap

The app initializes repository/orchestration, reads save summaries/latest save, then mounts Home. A startup failure mounts a stable error shell rather than inventing an empty city.

## Game presentation composition

Entering a live session creates:

```text
Generic GameShellView
GameUiCoordinator
static GameToolRegistry / GameToolCoordinator
GameInteractionRouter / GameCommandRouter
Scene
TerrainThreeProjection
TerrainThreeDebugOverlay
CityCamera
CityInputController
TerrainPointerPicker
TerraformGameTool (first reference tool)
```

The Game Shell knows generic hosts, not Terraform internals. Pointer observation reaches the active tool before gesture reduction for preview/cancellation only; canonical commits remain post-arbitration semantic taps. Leaving Game disposes UI coordinators, tool runtime, input, Three.js projection/debug resources, camera/scene resources, and DOM roots. Save/Load serializes none of these presentation resources.

## Responsive contract

```text
Compact  0–639 CSS px
Medium   640–1023 CSS px
Large    >=1024 CSS px
Short    height <600 CSS px
```

Compact uses a safe-area-aware equal-slot Tool Dock and one foreground bottom surface. New City is preview-first with local configuration surfaces; Load City is list-to-detail. Game never document-scrolls; local sheets/panels own overflow. Orientation/resize changes presentation only and preserves semantic tool/camera state.

## Tests

```text
UI focus/labels and 44px target style contract
New City seed validation and generate/create stages
Load empty and populated states
Resume disabled/absent when no save
IndexedDB real browser list/save/load/latest/remove
screen disposal prevents duplicate handlers
enter/leave game cleans presentation resources
```
