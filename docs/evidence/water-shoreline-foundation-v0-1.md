# Water & Shoreline Foundation v0.1 Evidence

## Status

Implementation, deterministic browser evidence, boundary audits, and full automated verification are complete on Draft PR #6. The milestone is stopped at the required owner visual-review gate. Merge remains unauthorized until the owner approves the evidence.

## Accepted Contract

- Ocean connectivity originates only from positive-length wet contact on the south map boundary.
- Water clipping follows the canonical Terrain triangle topology.
- Enclosed low basins remain unrendered unless connected through a positive-width channel.
- Water is derived from Terrain and is not added to the save schema.
- Presentation replacement is atomic and leaves one Water scene root after boot, load, and WebGL context restoration.

## Exact Implementation and Verification References

| Reference | Value |
| --- | --- |
| Task 7 implementation/evidence commit | `5a3397a759a8ba3db36d7953ef7041aff627776b` |
| Focused Water Chromium run | `30357668262` |
| Focused Water tests | 11 passed |
| Focused evidence artifact | `8687689845` (`water-shoreline-foundation-v0-1-evidence-corrected`) |
| Focused evidence digest | `sha256:47223a4e1cedcbe572ec4d400842944edd0590bca1bb776d0ffb87678c886326` |
| Task 8 audit head | `142337d38d9cd87b96a9427b55eaac0393acb955` |
| Task 8 boundary-audit run | `30358777017` |
| Task 8 audit artifact | `8687899583` (`water-task8-final-audit`) |
| Task 8 audit digest | `sha256:31955a896361c2ead85925ce60c0442797199657efdf3d29e3f3723a224531fe` |
| Full four-job CI run | `30358777358` |
| Full Chromium tests | 41 passed |
| Full browser-evidence artifact | `8688250981` |
| Full browser-evidence digest | `sha256:ca82b53cf81b1d2f6ead28d0556129392b669e11c3dd7aa862640446406fe3f5` |
| Coverage artifact | `8687909768` |
| Coverage digest | `sha256:e7825485fd446baba11cbd194e6b33c512d096819b0aabe80cc6c1941a229c53` |
| Application-build artifact | `8687913959` |
| Application-build digest | `sha256:5e898965e443db6906425f21eaded152606ee405f65f804819b67d3425d4e879` |

Temporary execution and audit workflows were removed from the feature branch after their evidence was captured.

## Automated Gate Results

The full CI run passed all required jobs:

- Quality and provenance: formatting, ESLint, strict TypeScript, and provenance checks.
- Unit, geometry, and golden tests: complete workspace coverage run.
- Build all packages and applications: complete recursive workspace build.
- Chromium smoke, interaction, and visual evidence: complete 41-test browser suite.

The focused Task 8 audit additionally passed:

- `water-core` and `water-three` coverage suites.
- Strict typechecks for both Water packages.
- Terrain Lab and Game production builds.
- `water-core` purity: no Three.js or DOM dependency.
- Terrain independence: no Water dependency in Terrain authority packages.
- Save ownership: no Water persistence or save-schema extension.
- Scope exclusion: no chunk signatures, dirty-Water scheduler, reflection, refraction, buoyancy, or WebGPU implementation.

## Deterministic Geometry Baseline

The canonical Game terrain uses seed `1464156977`, `WORLD_CONFIG`, and the complete 64-chunk Water presentation source.

| Metric | Deterministic value |
| --- | ---: |
| Sea triangles | 6,440 |
| Enclosed wet triangles | 0 |
| Shoreline segments | 188 |
| Surface triangles | 6,440 |
| Shoreline triangles | 379 |
| South-wall segments | 1 |
| Estimated geometry bytes | 754,710 |
| Geometry SHA-256 | `a9d773edd56d5ea2516d8f13239960f018f0e13bc029b2771991fe17c156d842` |

## Measured Canonical Runtime Evidence

The successful Chromium evidence run measured the canonical Game lifecycle after Water derivation and complete atomic presentation replacement:

| Metric | Measured value |
| --- | ---: |
| Water derivation duration | 122.3 ms |
| Water presentation duration | 112.0 ms |
| Water roots before context restoration | 1 |
| Water roots after context restoration | 1 |

These are evidence measurements from the GitHub-hosted Chromium runner, not hard performance budgets.

## Connectivity Fixture Baselines

| Fixture | Sea triangles | Enclosed wet triangles |
| --- | ---: | ---: |
| Straight coast | 4,352 | 0 |
| Bay | 5,116 | 0 |
| Peninsula | 4,960 | 2 |
| Chunk seam | 8,482 | 0 |
| Enclosed basin | 0 | 200 |
| Open channel | 770 | 0 |
| South wall | 1,476 | 0 |

## Visual Inventory

- `water-game-desktop.png`
- `water-game-mobile.png`
- `water-grid-selection.png`
- `water-straight-coast.png`
- `water-bay.png`
- `water-peninsula.png`
- `water-chunk-seam.png`
- `water-enclosed-basin.png`
- `water-open-channel.png`
- `water-south-wall.png`

## Visual Self-Review

The complete screenshot inventory was inspected after the successful focused Chromium run.

- Desktop and compact mobile framing keep the complete world visible within the usable viewport.
- Grid lines remain visible over Terrain and Water.
- The exact underwater cell selection `64, 116` remains visible and readable.
- Straight-coast, bay, and peninsula fixtures follow the Terrain topology without floating Water.
- The chunk-seam fixture has no visible Water crack or duplicated seam edge.
- The enclosed basin remains dry as required.
- The positive-width open channel connects the interior basin to the south-edge ocean.
- The south-wall fixture presents Water continuously down to the diorama boundary where Water reaches the south edge.
- No duplicate Water scene root appears after save/load or WebGL context restoration.

## Owner Visual-Review Gate

Automated and agent visual review: **PASS**.

Owner visual approval: **PENDING**.

PR #6 must remain unmerged until the owner reviews the evidence inventory and explicitly approves the Water & Shoreline Foundation v0.1 visuals.
