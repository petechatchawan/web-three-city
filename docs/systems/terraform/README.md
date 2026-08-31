# Terraform v1

Terraform is the player-facing Terrain editing system for Web Three City. It owns editing policy and transient tool state; it does not own canonical elevation storage.

## Authority boundary

- **Terraform owns** player editing semantics, brush/strength selection, Flatten reference selection, transient preview state, same-session Undo history, input-session interpretation, and the gameplay Terraform grid/preview overlay.
- **Terrain owns** canonical shared-vertex `LogicalElevation`, revisioning, validation, atomic mutation, snapshots, restore, and Three.js Terrain projection rebuilds.
- **World owns** gameplay-cell/chunk/region spatial semantics and unlocked-region state used by Terraform validation.
- **City Input owns** viewport pointer DOM listeners, pointer capture, camera gesture recognition, and the single semantic tap commit signal.
- **City Session owns** save/load lifecycle. Terraform v1 has no canonical persistence snapshot; committed edits persist through the existing `CitySaveV1.terrainSnapshot` only.

Terraform Grid Overlay is gameplay presentation. It is separate from Terrain Debug and is never persistence or mutation authority.

## Product semantics

Terraform v1 supports:

- operations: `raise`, `lower`, `flatten`
- brushes: `1×1`, `3×3`, `5×5` gameplay cells
- strengths: Fine `0.25m`, Normal `1m`, Strong `4m`
- Normal is the default strength
- Flatten strength controls are disabled; the first valid Flatten tap selects a canonical reference elevation without mutating Terrain
- one accepted tap maps to at most one atomic Terrain command and one Undo entry
- camera navigation always wins over Terraform commit
- Undo is transient to the current live city session and is empty after Create/Load/Resume

## Runtime pipeline

```text
Normalized pointer stream
  -> Terraform pointer session (preview/cancel only)

City Input semantic onTap
  -> Terrain semantic picker
  -> fresh Terraform plan
  -> Terraform runtime commit
  -> Terrain atomic command
  -> Terrain projection localized rebuild
  -> Terrain Debug localized rebuild
  -> Terraform overlay localized rebuild
  -> same-session Undo history
```

No Terraform code attaches a second viewport pointer listener stack and no Terraform drag path continuously mutates Terrain.

## Package surface

`@web-three-city/terraform` exports the stable domain/contracts used by consumers:

- `PlanTerraformInput`
- `TerraformInvalidReason`
- `TerraformOperation`
- `TerraformPlan`
- `TerraformPreview`
- `TerraformTerrainInvalidation`
- `TerraformUndoEntry`
- `TerraformUndoHistory`
- `TerraformVertexMutation`
- `buildBrushFootprint`
- `TerraformBrushFootprint`
- `TerraformBrushSize`
- `resolveFlattenCorner`
- `selectFlattenReference`
- `FlattenReferencePick`
- `FlattenReferenceRejectionReason`
- `FlattenReferenceResult`
- `SelectFlattenReferenceInput`
- `TerraformStrength`
- `strengthLevels`

`@web-three-city/terraform/composition` exposes construction/application entry points:

- `planTerraform(...)`
- `createTerraformUndoHistory(...)`
- `createTerraformThreeOverlay(...)`
- `TerraformThreeOverlay`
- `TerraformThreeOverlayConfig`
- `CreateTerraformThreeOverlayInput`

Application composition in `apps/game` owns live wiring to Terrain commands, projection/debug fan-out, semantic picking, City Input, toolbar state, persistence lifecycle, and disposal.

## Three.js presentation

The Terraform overlay:

- conforms gameplay-grid boundaries to canonical Terrain elevation reads
- renders only editable/unlocked land while active
- chunks grid geometry by World logical chunks
- de-duplicates shared edges inside each logical chunk
- has semantic layers for valid footprint, influence, invalid footprint, and Flatten reference
- shares materials by semantic layer rather than per cell
- rebuilds only invalidated logical chunks
- disposes geometry/material resources idempotently

It does not infer gameplay truth from rendered Terrain meshes.

## Persistence

Terraform does not add a `terraformSnapshot` to `CitySaveV1`.

```text
Terraform commit
  -> Terrain canonical elevation/revision changes
  -> existing Terrain snapshot capture
  -> CitySaveV1.terrainSnapshot
  -> Load/Resume restores Terrain
  -> Terraform transient session starts fresh
```

A save/load data path that requires Terraform-specific canonical state is outside Terraform v1 and requires an explicit architecture change.

## Verification and hardening

Normal repository verification remains:

```bash
pnpm verify
```

Terraform-specific hardening is opt-in locally and mandatory in the Terraform Hardening workflow:

```bash
pnpm terraform:performance:baseline
pnpm terraform:lifecycle:soak
```

The performance suite records measurements; it does not silently convert measurements into product thresholds. The lifecycle soak verifies repeated Terraform activation/edit/exit/Load/Resume behavior, listener and RAF ownership, Undo session boundaries, overlay cardinality, and IndexedDB teardown.

Canonical frozen product semantics are defined in `specs/TERRAFORM-V1-PRODUCT-SPEC.md`.
