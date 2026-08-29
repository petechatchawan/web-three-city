# World Snapshot Restore Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `systems/world`

## Purpose

Define deterministic restoration of city-specific World MapState from a semantic World snapshot.

## Snapshot authority

Existing World snapshot fields remain:

```text
mapDefinitionId
mapProfileId
mapProfileVersion
startingRegionId
unlockedRegionIds canonical order
```

## Restore

`restoreWorldSystem({prepared,snapshot})` is a World `./composition` construction operation.

It validates before publishing:

```text
map/profile identity and version match prepared definition
starting Region exists
all unlocked Regions exist
no duplicate unlocked Regions
starting Region is included in unlocked Regions
unlocked Region order is canonical according to MapDefinition region order
```

Phase 1 restore does not infer/purchase additional Regions and does not repair malformed data.

## Round trip

```text
createInitialWorldSystem -> captureSnapshot -> restoreWorldSystem -> captureSnapshot
```

must return deep-equal snapshots.

## Failure

Malformed or incompatible snapshots reject explicitly. No partial WorldSystem or silent fallback starting Region is published.
