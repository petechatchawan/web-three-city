# Terrain Engine v1 Production Closure

- **Status:** PRODUCTION CLOSED
- **Closed:** 2026-08-30
- **Code closure baseline:** `master@19fb9e6e9999ecb69cba0ad51ada3e0685c48b51`
- **Owner:** `systems/terrain`

## Closure decision

Terrain Engine v1 is closed for production as a system boundary. The canonical authority, deterministic generation, exact triangulated surface, mutation, snapshot/restore, Three.js projection, semantic picking, debug visualization, persistence integration, lifecycle behavior, and production acceptance gates are implemented and verified.

`Terraform`, Roads, Hydrology/Water, Zoning, and Buildings remain separate Terrain consumers. Their future product behavior does not reopen Terrain Engine v1 unless a regression or contract defect is found in a frozen Terrain-owned responsibility.

## Release evidence

### PR #114 — release gate baseline

PR #114 established the preceding remote release baseline and merged to `master@d262cce75916ac2c70542bb869528de2e6473fef` with CI/Sonar/post-merge verification complete.

### PR #115 — production hardening

PR #115 `test(terrain): close Terrain Engine v1 hardening gates` merged as:

```text
19fb9e6e9999ecb69cba0ad51ada3e0685c48b51
```

Pre-merge evidence:

```text
CI                    PASS — run 33320005005
Terrain Hardening     PASS — run 33320005000
Sonar Quality Gate    PASS — 0 new issues / 0 security hotspots
```

Post-merge evidence on the exact production baseline SHA:

```text
CI                    PASS — run 33322445907
Terrain Hardening     PASS — run 33322445967
tracked worktree      CLEAN
```

The hardening workflow uses `set -o pipefail` for every measurement/soak command piped through `tee`, so a failed benchmark or soak cannot be masked by log capture.

## Production world facts

```text
World Cells                 512 × 512
Canonical Terrain vertices  513 × 513 = 263,169
Logical Terrain chunks      256
Three.js render sectors     64 (8 × 8)
Projected vertices          270,400
Triangles                   524,288
Shared Terrain materials    1
Geometry buffer bytes       9,635,328
```

## Performance baseline

Measured on the GitHub-hosted Ubuntu runner from post-merge `master@19fb9e6e`.

### Node / composition baseline

| Measurement | Baseline |
| --- | ---: |
| World preparation | 33.343 ms |
| Terrain generation | 155.817 ms |
| Terrain system creation | 88.772 ms |
| Initial 64-sector projection | 578.421 ms |
| 1-sector localized rebuild | 17.145 ms |
| 2-sector localized rebuild | 16.283 ms |
| 4-sector localized rebuild | 31.018 ms |
| Snapshot capture | 18.628 ms |
| Snapshot JSON encode | 10.444 ms |
| Restore | 86.763 ms |
| Snapshot encoded bytes | 1,061,193 |

These are regression reference measurements, not optimization thresholds. Performance work must compare equivalent environment/workload evidence before changing production contracts.

### Browser baseline

```text
First runtime ready            2,082.3 ms
Active frame interval p50        505.4 ms
Active frame interval p95        673.9 ms
Active frame interval max        695.5 ms
Observed JS heap              33,100,000 bytes
Viewport                     1280 × 720 @ DPR 1
```

The hosted runner uses software/headless graphics characteristics. Browser frame-interval numbers are CI regression evidence only and are not a player-device FPS target.

## Lifecycle soak acceptance

The production hardening gate runs a 20-cycle browser lifecycle sequence after New/Save, alternating Load and Resume entries with exit/disposal between entries.

Accepted invariants:

```text
20 lifecycle cycles                         PASS
one canvas while runtime is live            PASS
zero canvas after exit                      PASS
tracked input listener count stable         PASS
listeners return to baseline after exit     PASS
pending requestAnimationFrame count -> 0    PASS
IndexedDB deletion after disposal           PASS
no page/runtime error during soak            PASS
```

Post-merge soak completed successfully in Terrain Hardening run `33322445967`.

## Snapshot compatibility policy

Terrain Engine v1 reads and writes `TerrainStateSnapshotV1` only.

```text
V1                validate + restore
V2+               reject until explicit migrator ships
missing version   reject
invalid version   reject
```

A future snapshot version requires an explicit deterministic migration tranche before it can become the write format. Migration must preserve the original persisted save on failure and must not regenerate Terrain from seed, query presentation state, silently clamp/discard canonical data, or mutate Terrain revision as a migration side effect.

## Closure invariants

The following are frozen production responsibilities of Terrain Engine v1:

```text
World-owned spatial coordinates
        ↓
canonical Terrain elevation authority
        ↓
deterministic generated field / restored snapshot
        ↓
fixed exact triangulated surface
        ↓
read/query + atomic mutation + revision/change set
        ↓
localized Three.js projection / semantic picking / debug presentation
```

No downstream subsystem may establish a second Terrain authority or mutate Terrain presentation buffers as canonical state.

## Reopen criteria

Terrain Engine v1 may be reopened only for one of these reasons:

1. A correctness regression violates a frozen Terrain contract.
2. A save compatibility defect risks canonical Terrain user data.
3. A lifecycle/resource defect is proven in Terrain-owned runtime code.
4. A performance regression is reproduced against the recorded production workload and materially violates an adopted future threshold.

New gameplay semantics belong to consumer systems, especially Terraform. New Terrain capabilities that intentionally change frozen contracts require an explicit vNext/design revision rather than silent expansion of v1.
