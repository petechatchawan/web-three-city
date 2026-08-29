# City UI and Persistence Adapter Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `apps/game`

## Purpose

Define the browser-specific UI and persistence adapters used by city-session orchestration while keeping business sequencing outside the app shell.

## Screen model

```text
Home
├─ Resume latest save when available
├─ New City
└─ Load City

New City
├─ name
├─ Seed64 + Randomize
├─ Generate
├─ fingerprint/eligible starting Regions
└─ Create City

Load City
└─ saved city cards -> Load

Game
├─ viewport
├─ city diagnostics
├─ Save
└─ Terrain Debug panel
```

Screen factories own their DOM listeners and return `dispose()`.

## Visual language

Use CSS design tokens and small app-owned primitives. Visual target is clean/neutral/shadcn-like:

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
Scene
TerrainThreeProjection
TerrainThreeDebugOverlay
CityCamera
CityInputController
TerrainPointerPicker
```

Leaving disposes these before switching screens. Save/Load does not serialize any of them.

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
