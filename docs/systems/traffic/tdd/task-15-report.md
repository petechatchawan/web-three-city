# Task 15 — Unified Atomic Intersection / Merge Arbitration

## Scope delivered

- Added `intersection-arbitration.ts` with deterministic front-of-incoming-lane eligibility, bounded integer age promotion, and maximal compatible all-or-nothing reservation-bundle grants.
- Added `ActiveNodeTraversal` facts to V2 Drive trips; reservation owner reconstruction now includes traversal resources.
- Integrated arbitration at the beginning of the V2 Traffic quantum. Only queues already present at quantum start participate, so a movement newly queued during the quantum waits until the next one.
- Granted traversal bundles remain on the trip until deterministic traversal rear-clearance progression releases them. No elapsed-time timeout releases merge, receiving, or conflict resources.
- Kept all changes in `traffic-core`; no renderer/presentation changes.

## TDD evidence

### RED

Command:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core test -- intersection-arbitration.test.ts'
```

Result: 8/8 tests failed as intended. The first seven failed because `arbitrateIntersectionMovements` was absent; the quantum test failed because a queued movement had no canonical traversal grant.

### GREEN

Focused command:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core test -- intersection-arbitration.test.ts'
```

Result: 53/53 tests passed (13 files).

## Verification

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core test'
# 13 files, 53 tests passed

/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core typecheck'
# passed

/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core exec vitest run test/traffic-scale.test.ts'
# 1 file, 1 test passed

/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core exec vitest run test/release-scale.test.ts'
# 1 file, 2 tests passed
```

## Assumptions and residual risks

- This bounded Task 15 cutover is V2 quantum authority. The legacy V1 `intersection-queue.ts` remains for V1 compatibility and is not consulted by `advanceTrafficQuantum`.
- Conflict resource templates are deliberately conservative at the current single-cell junction model: production `ConflictJunction` candidates reserve the node center plus their receiving admission. The public arbiter supports independent complete bundles, covered by the compatible-bundle test, for later graph-revision-specific conflict-template refinement.
- SaveV2 persistence of `activeNodeTraversal` is Task 17 scope; the current traversal facts are nevertheless immutable, validated, and sufficient to derive owner indexes within a running V2 snapshot.
- No commit, push, deployment, or renderer change was performed.
