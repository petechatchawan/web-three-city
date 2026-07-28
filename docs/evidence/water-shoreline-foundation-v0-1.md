# Water & Shoreline Foundation v0.1 Evidence

## Status

Implementation and deterministic browser evidence are being verified on Draft PR #6. Owner visual approval remains required before merge.

## Accepted Contract

- Ocean connectivity originates only from positive-length wet contact on the south map boundary.
- Water clipping follows the canonical Terrain triangle topology.
- Enclosed low basins remain unrendered unless connected through a positive-width channel.
- Water is derived from Terrain and is not added to the save schema.
- Presentation replacement is atomic and leaves one Water scene root after boot, load, and WebGL context restoration.

## Deterministic Geometry Baseline

The canonical Game terrain uses seed `1464156977`, `WORLD_CONFIG`, and the complete 64-chunk Water presentation source.

| Metric                   |                                                Deterministic value |
| ------------------------ | -----------------------------------------------------------------: |
| Sea triangles            |                                                              6,440 |
| Enclosed wet triangles   |                                                                  0 |
| Shoreline segments       |                                                                188 |
| Surface triangles        |                                                              6,440 |
| Shoreline triangles      |                                                                379 |
| South-wall segments      |                                                                  1 |
| Estimated geometry bytes |                                                            754,710 |
| Geometry SHA-256         | `a9d773edd56d5ea2516d8f13239960f018f0e13bc029b2771991fe17c156d842` |

## Connectivity Fixture Baselines

| Fixture        | Sea triangles | Enclosed wet triangles |
| -------------- | ------------: | ---------------------: |
| Straight coast |         4,352 |                      0 |
| Bay            |         5,116 |                      0 |
| Peninsula      |         4,960 |                      2 |
| Chunk seam     |         8,482 |                      0 |
| Enclosed basin |             0 |                    200 |
| Open channel   |           770 |                      0 |
| South wall     |         1,476 |                      0 |

## Required Visual Inventory

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

The final documentation descendant will record the exact implementation SHA, CI run and artifact identifiers, artifact digest, browser-test count, measured derivation and presentation durations, screenshot self-review, and owner visual-approval state.
