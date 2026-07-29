# Terraform Foundation v0.1 — Package Placement Amendment

- Status: **Accepted by delegated recommendation authority on 2026-07-29**
- Supersedes only the package-placement and planned-file-map portions of:
  - `2026-07-29-terraform-foundation-v0-1-design.md`
  - `2026-07-29-terraform-foundation-v0-1.md`
- All behavioral, validation, input, Preview, Undo, Water, evidence, and acceptance contracts remain unchanged.

## Decision

Do not add `terraform-core` or `terraform-three` workspace packages in v0.1.

Place the pure Terraform domain modules in the existing pure TypeScript Terrain package:

```text
packages/terrain-core/src/terraform-contracts.ts
packages/terrain-core/src/terraform-brush.ts
packages/terrain-core/src/terraform-cell-line.ts
packages/terrain-core/src/terraform-plan.ts
packages/terrain-core/src/terraform-undo-store.ts
packages/terrain-core/test/terraform-*.test.ts
```

Place the Three.js Preview modules in the existing Terrain presentation package:

```text
packages/terrain-three/src/terraform-preview-geometry.ts
packages/terrain-three/src/terraform-preview-presentation.ts
packages/terrain-three/test/terraform-preview-*.test.ts
```

Export the new APIs through the existing package `index.ts` files.

## Rationale

- Terraform directly operates on Terrain snapshots, shared lattice vertices, dirty regions, and canonical topology already owned by `terrain-core`.
- Preview directly consumes Terrain topology and belongs beside Grid and Selection presentation in `terrain-three`.
- Both existing packages already enforce the required pure-core versus Three.js dependency boundary.
- Two additional workspace packages would add manifests, lockfile importers, build configuration, CI surface, and long-term maintenance without creating a meaningful new dependency boundary for a solo developer.
- Future extraction remains possible if Terraform becomes independently reusable or gains non-Terrain dependencies.

## Revised task mapping

- Tasks 1–3 modify `terrain-core` rather than creating `terraform-core`.
- Task 4 modifies `terrain-three` rather than creating `terraform-three`.
- No Terraform-specific workspace importer or lockfile entry is required.
- Task 6 adds no new Game dependency because Game already depends on both Terrain packages.

This amendment is a maintenance optimization only. It does not reduce tests, evidence, atomicity, interruption handling, or acceptance requirements.
