# Building Content & Occupancy Foundation v0.1 Evidence

## Status

Implementation, deterministic browser acceptance, visual evidence capture, and automated/manual test specifications are complete on the feature branch. Static integration closure is complete, temporary authoring artifacts are removed, and the branch is ready for the Owner's final verification gate.

The PR remains Draft and unmerged. No verification result is claimed until the Owner runs the final test pass.

## Static closure record

- Building-aware Zone preview publishes the guarded reason and exact blocked-cell count.
- Optional Building snapshot wiring is compatible with `exactOptionalPropertyTypes`.
- Building Definition compatibility declarations are normalized, unique, resolvable, immutable, and fail closed.
- Building mutation commit removes unsafe non-null assertions and re-plans against current authoritative inputs.
- Building presentation rejects malformed empty footprints instead of deriving a non-finite elevation.
- WorldSaveV3 Building placement validation remains a Result-returning fail-closed boundary.
- Existing Terraform interaction-evidence semantics and canonical scene root names are preserved.
- Standard repository CI workflow is restored from `master` for the Owner's test gate.
- Temporary workflows, triggers, diagnostic output, and authoring scripts are absent from the final PR diff.

## Manual acceptance matrix

1. Build a valid Road and paint homogeneous Residential, Commercial, and Industrial lots.
2. Select **Develop Zones**, release on the world, and confirm deterministic Buildings appear.
3. Confirm larger compatible definitions win when a valid 2×2 or 1×2 lot exists.
4. Confirm Building footprints never span mixed Zones, water, non-flat terrain, Roads, or existing Buildings.
5. Confirm Residential, Commercial, and Industrial prototypes are visually distinct.
6. Select **Bulldoze Building**, release on any occupied footprint cell, and confirm the whole Building disappears while the Zone remains.
7. Confirm Road, Zone, and Terraform operations reject Building-occupied cells.
8. Confirm Road bulldoze rejects removal of required Building frontage.
9. Save, mutate, load, and confirm Building instances, rotations, counts, and occupancy return.
10. Undo both development and bulldoze once and confirm the Building revision advances.
11. Confirm old WorldSaveV1/V2 data loads with an empty Building layer.
12. Confirm reload/context restoration creates exactly one `building-committed-root`.

## Verification record

- Exact verification head: pending Owner test gate
- Focused tests: not run by instruction
- `pnpm check`: not run by instruction
- Browser acceptance: not run by instruction
- Visual review: pending Owner
- Merge authorization: not granted
