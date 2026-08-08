# Dependent-World Consistency v0.1 — Verification Record

**Status:** Candidate verification pending  
**Owning slice:** Architecture / Infrastructure Upgrade — Implementation PR 3  
**Verification level:** Level 4 required

## Verified Contracts Before Exact-Head Gate

The implementation slice is expected to preserve these stable contracts before final candidate verification:

- Building content is fenced by deterministic fingerprint when RCI work is planned and committed.
- Building changes reconcile RCI dwelling/workplace inventory before publication.
- complete candidate Terrain/Water/Road/Zone/Building/Simulation/RCI state is validated before one committed-world publication.
- Save reads only coherent committed-world authority and Load publishes through the same transaction seam.
- Undo restores the complete prior dependent domain world while advancing only the application publication revision.
- `GameRuntime.snapshot()` is the read authority for application consumers; `main.ts` does not keep a second Simulation/Building/Save authority.
- logical ticks publish through the committed-world seam for both automatic-growth and simulation-only paths.
- committed-world reads preserve canonical defensive snapshot semantics for typed-array-backed domain state.
- post-publication presentation failures are reported as degraded presentation and do not roll back domain authority.

## Regression Evidence Added During Implementation

Level 4 browser execution exposed that a plain-object defensive copy of typed-array-backed snapshots could be mutated by downstream planners. The committed-world read boundary now reconstructs canonical snapshots instead, and a curated-runtime Road publication regression test verifies repeated Road publications from committed reads.

Dependent-world Undo intentionally restores prior domain snapshot revisions. Browser characterization for Terraform and Road therefore asserts exact restored domain revisions rather than requiring a new domain revision; only the application publication revision advances on Undo.

## Candidate Gate

Before merge, the exact candidate must satisfy:

1. Lean CI / `pnpm verify` on the candidate head.
2. Full Level 4 / `pnpm verify:full` on the same candidate head.
3. Full Chromium browser suite with no failures.
4. Clean-worktree verification.
5. No source or documentation mutation after accepted exact-head evidence.
6. Squash merge with expected-head guard.
7. Merged content tree equal to the verified candidate content tree.

Run IDs, artifact IDs, hashes, and post-merge tree evidence are recorded in PR metadata/comments so this stable record does not invalidate the verified candidate head.
