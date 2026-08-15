# M6.4 City UI Release Closure

**Status:** CLOSED / FROZEN / PASS  
**Date:** 2026-08-15  
**System:** City UI  
**Canonical released baseline:** `master@18623b1c6b5d4add0b39be08fa13962b9a80c4b4`

## Closure decision

M6.4 Mobile Declutter, Inspect & Interaction Fidelity is accepted and frozen as the released City UI baseline.

Further City UI presentation or interaction changes must start a new milestone/spec. M6.4 authority boundaries and acceptance contracts are not reopened by default.

## Accepted product surface

- world/map remains the primary visual surface,
- persistent primary bottom entries are `Build` and `City`,
- Terrain / Roads / Zones / Buildings are on-demand Build categories,
- Build closes after a concrete tool is selected and may resume the active category,
- active-tool context is compact and contextual,
- Inspect uses a bounded contextual surface rather than the generic tall management sheet,
- R/C/I demand uses explicit bars,
- EN/TH presentation localization is supported through the shared locale seam,
- simulation controls remain compact and state-preserving,
- HUD/overlay whitespace does not steal world input,
- gameplay, Economy, RCI, Simulation, Inspect projection, DialogHost, Save/Load, Undo, Terrain, Road, Zoning, and Building authority remain outside presentation state.

## Automated release evidence

PR #59 exact release head before merge:

`6a96f63e9c113d31a7ce214371fc5727bd7acb08`

CI run `31881556253`:

- Lean CI / `pnpm check`: PASS,
- Full Browser: 132/132 PASS in 25.7m,
- clean-worktree: PASS (`Working tree is clean.`),
- SonarQube Cloud Quality Gate: PASS,
- Sonar Duplication on New Code: 0.0%,
- Sonar Security Hotspots: 0,
- browser evidence artifact: `9246443337`,
- artifact SHA-256: `abe3928e340ce400f2a2d84f4901308352f64c3da1a9e6424679f3f9789fc06c`.

The verified PR merge-ref tree was:

`efa7c81b6ea6e5692d44450f59e15d58b43ca088`

The squash release commit on `master` has the same tree SHA, so the released content is byte-identical to the tree that passed the release verification.

## Manual acceptance

Owner Manual Visual Acceptance: **PASS**.

The accepted manual review covered portrait and landscape presentation, including the canonical 414×896 viewport, map dominance, compact HUD, Build/City bottom chrome, R/C/I demand bars, simulation controls, and responsive layout.

## Release integration

Parent release PR #59 was squash-merged into `master` as:

`18623b1c6b5d4add0b39be08fa13962b9a80c4b4`

Legacy remediation PRs #60 and #61 were closed without merge as superseded.

## Freeze rule

M6.4 is now a historical accepted baseline. Any future City UI work that changes its presentation or interaction contracts must:

1. open a new named milestone,
2. define the changed visual/interaction contract explicitly,
3. preserve existing runtime/domain authority boundaries unless a separately approved architecture change says otherwise,
4. carry its own RED/GREEN and browser/manual acceptance evidence.

This closure document is documentation-only and does not change runtime behavior.
