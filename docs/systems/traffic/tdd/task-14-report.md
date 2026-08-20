# Task 14 — Drive node classification

## Delivered

- Added `drive-node-classification.ts`, a pure derived classifier over canonical directed Drive edges.
- `SimpleContinuation` covers both directed straight continuations and directed degree-2 bends.
- `Diverge` requires one incoming and multiple outgoing Drive edges; `Merge` requires multiple incoming and one outgoing edge.
- `ConflictJunction` requires multiple incoming and multiple outgoing edges, covering directed T and four-way junctions.
- Added `DriveNodeClassificationCache`, keyed by Traffic graph source revisions and node ID. It is derived-only and never persists authority across a graph revision.
- Exported the classifier/cache through the traffic-core public index.
- This task intentionally adds no generic degree queue, turn/movement conflict classification for pure merges, or Task 15 junction/merge arbitration.

## TDD evidence

Focused RED→GREEN commands used Node 22 because this workspace's pnpm version requires `node:sqlite`.

- RED: `drive-node-classification.test.ts` failed with `classifyDriveNode is not a function` and `DriveNodeClassificationCache is not a constructor`.
- GREEN: the focused classifier suite passed after the minimal pure classifier, revision cache, and public export were added.

The tests use literal directed graph fixtures for straight continuation, bend, diverge, pure merge, T junction, four-way junction, and graph-revision cache isolation.

## Verification

- PASS: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core test'` — 12 files, 45 tests.
- PASS: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core typecheck'`.
- PASS: scoped `git diff --check`.

## Assumptions and residual risk

- A node without both incoming and outgoing Drive edges is not a traversable node and returns `null`; terminal/dead-end semantics are outside the specified Task 14 classes.
- Cache identity combines `sourceRoadRevision`, `sourceBuildingRevision`, and node ID because `TrafficGraph` exposes those as its revision inputs. Vehicle topology presently changes with the Road revision; retaining Building revision makes the cache safe if future Drive access topology uses it.
- Task 15 must consume this classification to derive merge/conflict resources and arbitration. Task 14 does not alter existing queue service behavior.
