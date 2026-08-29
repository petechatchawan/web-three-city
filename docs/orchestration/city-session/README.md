# City Session Orchestration

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `orchestration/city-session`
- **Package:** `@web-three-city/orchestration-city-session`

## Purpose

Own the cross-system product workflow for creating, saving, loading, and resuming one city while leaving World and Terrain as the only semantic authorities for their respective data.

## Why orchestration exists

New/Load/Save/Resume coordinates multiple semantic owners plus persistence. Putting that sequencing in `apps/game/create-game.ts` would create hidden business policy in composition; putting it in either World or Terrain would violate ownership.

## Operations

```text
prepareNewCity(name, seed64)
createNewCity(preview, startingRegionId)
saveCity(liveSession)
loadCity(cityId)
resumeCity()
listCities()
```

Exact public contracts are defined in `specs/CITY-SESSION-DESIGN.md`.

## Ports

```text
WorldLifecyclePort
TerrainLifecyclePort
CitySaveRepository
Clock
IdSource
```

The concern never imports `@web-three-city/world/composition` or `@web-three-city/terrain/composition`. App composition implements lifecycle ports using those surfaces.

## State ownership

`CitySession` is a runtime aggregate reference to live World/Terrain capabilities plus city metadata. It does not duplicate canonical World/Terrain state. Persistent truth is reconstructed from system snapshots.

## Failure policy

Expected failures are typed and propagated. No fallback seed, fallback Region, silent save deletion, or regeneration of corrupt loaded Terrain is permitted.

## Binding spec

- `specs/CITY-SESSION-DESIGN.md`
