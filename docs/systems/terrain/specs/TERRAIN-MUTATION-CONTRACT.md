# Terrain Mutation Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Terrain System Design, Terrain Authority Contract, World Spatial Contract, ADR-001

## 1. Purpose

Phase 1 Terrain mutation is the owner-level atomic mechanism that future Terraform and other approved callers may use. It is not itself Terraform product semantics.

Mutation targets exactly one canonical authority: Terrain.

## 2. Command shape

Conceptual public mutation command:

```text
ApplyTerrainEdits {
  edits: TerrainVertexEdit[]
}

TerrainVertexEdit {
  vertex: World.VertexCoord
  elevation: LogicalElevation
}
```

The mutation surface is exported only through `@web-three-city/terrain/commands`.

## 3. Duplicate edit rule

Two or more edits targeting the same `VertexCoord` in one command are invalid even if they request the same final elevation.

The entire command is rejected with:

```text
TERRAIN_MUTATION_DUPLICATE_VERTEX
```

There is no last-write-wins or first-write-wins normalization. This exposes caller defects and keeps command meaning unambiguous.

## 4. Deterministic normalization order

After duplicate detection, valid edit requests are normalized before validation/application to canonical order:

```text
primary: vertex.z ascending
secondary: vertex.x ascending
```

Caller input order has no semantic effect.

The normalized order is used for validation, actual-change detection, canonical mutation, and result/change-set reporting.

## 5. Validation order

For deterministic rejection behavior, command-level checks run in this fixed order:

```text
1. duplicate VertexCoord detection
2. VertexCoord validity / map bounds
3. owner Chunk availability
4. LogicalElevation integer/product-bound validity
```

Within each class, the first offending edit in canonical normalized coordinate order identifies the rejection detail.

No canonical state changes during validation.

## 6. Stable rejection codes

Expected command rejections:

```text
TERRAIN_MUTATION_DUPLICATE_VERTEX
TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS
TERRAIN_MUTATION_CHUNK_UNAVAILABLE
TERRAIN_MUTATION_ELEVATION_INVALID
TERRAIN_MUTATION_ELEVATION_OUT_OF_RANGE
```

`TERRAIN_MUTATION_ELEVATION_INVALID` covers non-integer/non-contract values at untyped external boundaries. Typed internal TypeScript callers should normally be unable to construct such values without explicit parsing.

Rejection detail may include the offending World coordinate/chunk/value as immutable diagnostic data, but no localized UI message belongs in the contract.

## 7. Empty mutation

An empty edit list is a valid no-op.

Result:

```text
success
changed = false
previousRevision = currentRevision
newRevision = currentRevision
empty TerrainChangeSet
```

No rejection and no revision change occur.

## 8. Same-value edit

An edit that sets a vertex to its existing elevation is valid but is removed from the actual-change set after all request validation succeeds.

A command containing only same-value edits is a successful no-op and does not advance TerrainRevision.

Duplicate detection still occurs before same-value filtering.

## 9. Atomic commit

After complete validation:

```text
normalized valid edits
      ↓
filter actual value changes
      ↓
if none -> no-op success
      ↓
apply all actual changes as one Terrain commit
      ↓
TerrainRevision += exactly 1
      ↓
produce TerrainChangeSet
```

If any expected validation fails, zero vertices change and revision remains unchanged.

A programming/infrastructure failure during commit is not converted into a partial successful business result; implementation must preserve atomic owner semantics.

## 10. TerrainChangeSet

Successful actual mutation produces:

```text
TerrainChangeSet {
  previousRevision
  newRevision
  changedVertices[]
  affectedCells[]
  touchingLogicalChunks[]
}
```

### changedVertices

Contains only vertices whose canonical values actually changed, in `(z,x)` ascending order.

### affectedCells

Union of World `incidentCells(vertex)` for all changed vertices, de-duplicated and ordered `(z,x)` ascending.

### touchingLogicalChunks

Union of World `touchingChunks(vertex)` for all changed vertices, de-duplicated and ordered `(z,x)` ascending.

No derived render-sector IDs belong in TerrainChangeSet because render sectors are presentation topology.

## 11. Revision semantics

For an actual atomic change:

```text
newRevision = previousRevision + 1
```

Edit count does not affect revision increment.

Rejected/no-op commands preserve the exact previous revision.

## 12. Command result

Conceptual success value:

```text
TerrainMutationReceipt {
  changed: boolean
  previousRevision
  newRevision
  changeSet
}
```

This is normal command result data, not an Integration Event and not an instruction for the caller to publish an event.

Phase 1 has no runtime event bus requirement. The app may use the receipt to synchronize the Terrain-owned presentation projection after a user/application action.

## 13. Mutation versus generation/materialization

Initial generation materialization is construction, not `ApplyTerrainEdits` replay over 263,169 vertices.

Generation creates the initial TerrainState at revision 0 through a dedicated validated materialization path.

Runtime mutation starts from that authority and follows this contract.

## 14. Mutation versus Terraform

This contract does not define:

```text
Raise/Lower tool strength
brush radius/shape
flatten behavior
Terraform cost
input gesture
preview
undo stack
terrain-edit policy for roads/buildings/water
```

Phase 2 Terraform translates approved player intent into Terrain edits subject to its own policy, then uses this owner mutation mechanism.

## 15. Snapshot/presentation synchronization

A mutation does not write save bytes and does not manipulate Three.js geometry directly.

Downstream flow:

```text
Terrain command commits
  ↓
TerrainMutationReceipt / TerrainChangeSet
  ↓
Terrain presentation invalidates affected derived sectors
  ↓
future persistence may later capture a new Terrain snapshot
```

Canonical commit remains valid if presentation refresh fails; presentation failure is not a Terrain business rejection.

## 16. Tests

Required tests include:

```text
empty edit success/no revision
same-value edit success/no revision
one edit -> exactly one revision increment
many edits -> exactly one revision increment
caller order does not change result/order
duplicate same-value edit rejects
duplicate conflicting edit rejects
out-of-bounds rejects atomically
unloaded Chunk rejects atomically
out-of-range elevation rejects atomically
changedVertices exact deterministic order
affectedCells exact incidence/de-dup/order
touchingChunks exact incidence/de-dup/order
failed command leaves all prior elevations unchanged
```

Property tests should compare a pre-command canonical snapshot with the post-rejection snapshot for exact equality.

## 17. Binding invariants

```text
Terrain mutation is single-authority and atomic.
Duplicate Vertex edits always reject.
Valid edit order is canonical (z,x), independent of caller order.
All validation completes before any canonical write.
Same-value/empty mutations are successful no-ops.
Only actual canonical change increments revision, exactly once.
TerrainChangeSet contains deterministic World-topology-derived facts.
Render-sector IDs and Three.js objects never enter mutation contracts.
Terrain mutation foundation is not Terraform gameplay policy.
```
