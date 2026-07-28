# Terraform Foundation v0.1 Evidence

## Status

Implementation is complete through browser acceptance and visual-evidence capture on Draft PR #7. Final exact-head repository verification and owner visual acceptance remain pending.

## Accepted Contract

- Raise, Lower, and Flatten operate on the authoritative shared Terrain height lattice.
- Brushes are square `1 × 1`, `3 × 3`, and `5 × 5` footprints.
- Every cell crossed during a drag is accumulated into one immutable-base Preview plan.
- Preview changes no committed Terrain or Water state.
- A valid stroke commits exactly once at pointer release.
- Cancellation, lost capture, blur, context loss, or second-touch camera takeover commit nothing.
- Range, cardinal height delta, and no-op validation are transaction-wide and all-or-nothing.
- Undo stores one previous Terrain lattice, restores it with a newer revision, and is consumed once.
- Commit and Undo each trigger exactly one complete Water derivation and presentation replacement.
- `TerrainSaveV1` remains unchanged; Undo and Water are not persisted.

## Architecture

Terraform domain behavior is implemented inside the existing pure TypeScript `terrain-core` boundary. Transient Three.js Preview presentation is implemented inside `terrain-three`. This avoids two additional workspace packages while preserving the pure-core versus renderer dependency boundary.

Input ownership is integrated through one optional primary-pointer tool delegate in `camera-input`. A second touch cancels the Terraform stroke and transfers both contacts to the existing two-finger camera gesture controller.

## Automated Coverage

### Domain and presentation

- square brush expansion and boundary clipping;
- deterministic supercover cell-line rasterization;
- shared-vertex deduplication;
- Raise, Lower, and locked-target Flatten planning;
- height-range, cardinal-delta, and no-op rejection;
- immutable commit with monotonic revision and receipt;
- stale-plan and invalid-plan rejection;
- one-level monotonic Undo;
- canonical topology Preview geometry;
- valid green and invalid red Preview colors;
- atomic Preview root replacement and idempotent disposal;
- primary-pointer claim, cancellation, and two-finger camera handoff.

### Chromium acceptance

- accumulated Preview with no Terrain/Water mutation before release;
- one Commit and one Water update at release;
- brushes `3 × 3` and `5 × 5` with exact affected-cell counts;
- pointer cancellation without mutation;
- second-touch camera takeover without commit;
- no-op Flatten invalid Preview;
- Lower and Flatten shared transaction paths;
- context-loss cancellation;
- load clearing Undo and Preview;
- Undo with newer Terrain and Water revisions.

## Visual Inventory

- `terraform-game-desktop-navigate.png`
- `terraform-raise-preview-1x1.png`
- `terraform-raise-preview-5x5.png`
- `terraform-invalid-preview.png`
- `terraform-after-commit-water.png`
- `terraform-after-undo.png`
- `terraform-game-mobile-tools.png`
- `terraform-mobile-drag-preview.png`
- `terraform-performance-evidence.json`

## Timing Evidence

`terraform-performance-evidence.json` records browser-observed end-to-end Commit and Undo durations, current Water derivation and presentation durations, revision alignment, Water rebuild counts, scene-root counts, and the screenshot inventory. These are observations, not CI budgets.

## Boundary Audit Requirements

Final verification must confirm:

- no DOM or Three.js import in the Terraform domain modules under `terrain-core`;
- no Terraform reverse dependency from Water, generator, or world packages;
- no save-schema extension;
- no Redo, multi-level Undo, automatic slope propagation, incremental Water scheduler, economy, workers, or WebGPU implementation;
- no temporary diagnostic workflow or script remains;
- the full original Chromium suite plus Terraform acceptance passes on the exact final head.

## Final Gate

- Focused Terraform Chromium acceptance: **PASS before visual-evidence addition**.
- Unit, geometry, and presentation suites: **PASS before final cleanup**.
- Full exact-head CI: **PENDING**.
- Visual artifact inspection: **PENDING**.
- Owner visual acceptance: **PENDING**.
