# City Session Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `orchestration/city-session`

## Public concepts

```ts
CityId = branded string
CityName = trimmed non-empty string with product max length
CitySaveV1 = versioned plain-data persistence envelope
NewCityPreview = generated Terrain facts before city authority is committed
LiveCitySession = metadata + World/Terrain public capabilities
```

## Ports

### WorldLifecyclePort

```text
prepareDefinition()
createInitial(prepared, selectedRegion, eligibleRegions)
restore(snapshot)
```

### TerrainLifecyclePort

```text
prepare(worldDefinition, seed64)
create(preparedWorldSpatial, preparedTerrain)
restore(preparedWorldSpatial, terrainSnapshot)
```

The port result uses discriminated success/rejected outcomes and retains owner error codes where useful.

### CitySaveRepository

```text
list() -> summaries
load(cityId)
latest()
save(save)
remove(cityId)
```

### Environment

```text
Clock.nowIso()
IdSource.nextCityId()
```

## New City two-stage workflow

### Prepare

Input:

```text
name
seed64
```

Sequence:

```text
validate name
WorldLifecycle.prepareDefinition
TerrainLifecycle.prepare(seed64)
collect eligible RegionIds in deterministic candidate order
return NewCityPreview
```

No World MapState/TerrainSystem is committed yet.

### Create

Input includes the exact preview token/object and selected RegionId.

Sequence:

```text
require selected Region is in preview eligible list
WorldLifecycle.createInitial
TerrainLifecycle.create from exact prepared Terrain field
allocate cityId + timestamps
capture World/Terrain snapshots
repository.save initial CitySave
return LiveCitySession
```

The Terrain field is not regenerated between Preview and Create.

## Save

```text
capture World snapshot
capture Terrain snapshot
updatedAt = clock.nowIso
lastPlayedAt = updatedAt
repository.save complete record
return updated metadata
```

If repository save fails, live systems remain valid and the previous durable save is not declared updated.

## Load

```text
repository.load
validate CitySaveV1
WorldLifecycle.restore
TerrainLifecycle.restore
create LiveCitySession
update lastPlayedAt through explicit repository.save
```

If lastPlayedAt update fails after restore, Load returns a persistence failure rather than pretending durable metadata changed. Restored system objects are releaseable by the caller and contain no hidden global registration.

## Resume

`repository.latest()` selects highest `lastPlayedAt`; equal timestamp tie break is lexical `cityId` ascending. Resume delegates to the same restore policy as Load.

No save -> `{status:"empty"}`.

## List

Returns canonical save summaries ordered by:

```text
lastPlayedAt descending
cityId ascending
```

## Save validation

Reject:

```text
unsupported schemaVersion
invalid/missing city metadata
invalid ISO timestamps
World snapshot rejection
Terrain snapshot rejection
```

Do not coerce malformed data into defaults.

## Non-goals

```text
autosave scheduling
cloud save
multi-tab conflict resolution beyond IndexedDB transaction safety
save migration beyond explicit schema rejection
Terraform/Road commands
```
