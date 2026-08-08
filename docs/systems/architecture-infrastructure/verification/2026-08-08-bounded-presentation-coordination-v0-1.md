# Bounded Presentation Coordination v0.1 — Verification Record

**Status:** Candidate verification pending  
**Owning slice:** Architecture / Infrastructure Upgrade — Implementation PR 4  
**Verification level:** Level 4 required

## Candidate Contracts

- `game-bootstrap.ts` remains the concrete composition root; domain rules do not move into the presentation coordinator.
- `PresentationCoordinator` accepts only explicit committed-world presentation callbacks and owns no Terrain, Road, Zone, Building, Simulation, RCI, tool, or Undo authority.
- Complete-world synchronization executes only after committed-world publication when used by `WorldTransactionCoordinator`.
- Incremental and no-op presentation ports recover through the same complete committed-world rebuild path.
- WebGL context restoration rebuilds Terrain, Water, Grid, Road, Zone, Building, selection, and input terrain-object presentation from one committed-world snapshot instead of maintaining a second handwritten rebuild sequence.
- Background Growth presentation does not change active tool or Undo ownership.
- Presentation lifecycle cleanup runs even when an adapter throws; presentation failure remains post-publication degradation and never rolls domain authority back.
- Save wire schemas, deterministic domain behavior, and gameplay semantics remain unchanged.

## Candidate Gate

Before merge, the exact candidate must satisfy:

1. Focused `PresentationCoordinator` and bootstrap authority tests.
2. `apps/game` test and typecheck gates.
3. Targeted browser interaction/transaction coverage where available.
4. Lean CI / `pnpm verify` on the candidate head.
5. Full Level 4 / `pnpm verify:full` on the same candidate head.
6. Full Chromium browser suite with no failures.
7. Clean-worktree verification.
8. No source or documentation mutation after accepted exact-head evidence.
9. Squash merge with expected-head guard.
10. Merged content tree equal to the verified candidate content tree.

Run IDs, test counts, artifact IDs/hashes, and post-merge tree evidence belong in PR metadata/comments so this committed candidate record does not invalidate exact-head evidence.
