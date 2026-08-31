# Terraform v1 Production Closure

- **Status at this commit:** PRODUCTION CLOSED
- **Evidence date:** 2026-08-31
- **Implementation baseline:** `1a80f2d037ac34edf62598492f800824de8f5ba7`
- **Final pre-merge candidate:** `fe9a2932abd943d3e5f961f5539a3718385fa18c`
- **Production merge:** `ece3fe8ecbeb2c1e6d3393b6b19f7014852b2141`
- **Pull request:** #123
- **Owner:** `systems/terraform` with application composition in `apps/game`

## Closure decision

Terraform v1 is production closed. TF4–TF7 complete the production interaction path on top of the already-closed TF1–TF3 foundation without creating a second Terrain authority. PR #123 merged with the verified expected head, and the resulting production merge passed fresh local and remote post-merge verification.

The production boundary remains:

```text
City Input owns DOM pointer listeners, capture, gestures and semantic tap
        ↓
Terraform owns editing intent, transient preview, Flatten reference and Undo policy
        ↓
Terrain owns canonical elevation, atomic mutation, revision and persistence snapshot
        ↓
Terrain / Terraform Three.js presentation rebuild from canonical authority
```

Terraform v1 introduces no canonical `terraformSnapshot`. Save/Load remains authoritative through the existing `CitySaveV1.terrainSnapshot`.

## Release-gate override — SonarQube Cloud

Owner decision on 2026-08-31: SonarQube Cloud / SonarCloud is deferred and is **not** part of the Terraform v1 production release gate at this time.

The repository contains no Sonar workflow or `sonar-project.properties`; the visible `SonarCloud Code Analysis` check is emitted by the external SonarQubeCloud GitHub App. That external check is informational/non-gating until Sonar is explicitly re-enabled by a later owner decision. The GitHub App installation itself is account/repository integration state outside this repository and is not used as closure evidence here.

## Final pre-merge evidence

Final pre-merge candidate SHA:

```text
fe9a2932abd943d3e5f961f5539a3718385fa18c
```

Remote evidence on that exact SHA:

```text
PR #123
PR CI                    PASS — run 33369754784
Push CI                  PASS — run 33369750814
Terraform Hardening      PASS — run 33369754789
Terrain Hardening        PASS — run 33369754774
Architecture             PASS — 7 packages / 126 edges / 0 violations
Tracked worktree         CLEAN
```

Terraform Hardening run `33369754789` verified exact HEAD before executing repository verification, performance baseline, lifecycle soak, clean-worktree verification and artifact upload.

## Production merge

PR #123 merged the verified final candidate into `master` as:

```text
ece3fe8ecbeb2c1e6d3393b6b19f7014852b2141
```

The merge was executed with the expected PR head locked to:

```text
fe9a2932abd943d3e5f961f5539a3718385fa18c
```

After fetch/checkout/pull, local `master` and `origin/master` both resolved to `ece3fe8ecbeb2c1e6d3393b6b19f7014852b2141` with a clean working tree.

## Post-merge remote evidence

Fresh remote evidence on the exact production merge SHA:

```text
CI                    PASS — run 33372507204
Terraform Hardening   PASS — run 33372507253
Terrain Hardening     PASS — run 33372507254
Exact HEAD checks     PASS
Tracked worktree      CLEAN
```

Terraform Hardening run `33372507253` completed repository verification, performance baseline, the full Terraform lifecycle soak, clean-worktree verification and artifact upload on `master@ece3fe8e`.

## Post-merge local verification

Fresh local verification was executed on `master@ece3fe8e` using Node 22.18.0.

```text
pnpm verify                          PASS
Terraform package tests             53 / 53
Game tests                          49 passed / 2 opt-in skipped
Browser suite                       20 passed / 4 opt-in skipped
Architecture check                  7 packages / 126 edges / 0 violations
Production build                    PASS
Formatting                          PASS
Lint                                PASS
Typecheck                           PASS
pnpm terraform:performance:baseline PASS
pnpm terraform:lifecycle:soak       PASS — 20 cycles / 1 passed
```

The local post-merge browser suite continued to verify mouse commit/navigation precedence, touch takeover, Flatten reference semantics, Undo, save/load exact Terrain persistence, mobile viewport behavior, disposal and existing Terrain regressions.

## Performance baseline

Performance evidence is measurement-first and remains a regression reference, not an adopted production threshold.

### GitHub-runner pre-merge baseline

Measured in Terraform Hardening run `33368483274` on the GitHub-hosted Ubuntu runner:

| Measurement                        |  Baseline |
| ---------------------------------- | --------: |
| Raise 1×1 planning                 |  0.678 ms |
| Raise 3×3 planning                 |  0.365 ms |
| Raise 5×5 planning                 |  0.123 ms |
| Flatten 5×5 planning               |  0.121 ms |
| Overlay construction               |  0.623 ms |
| Initial unlocked-grid construction | 43.140 ms |
| Overlay rebuild — 1 logical chunk  |  1.659 ms |
| Overlay rebuild — 2 logical chunks |  2.864 ms |
| Overlay rebuild — 4 logical chunks |  6.140 ms |
| Commit + localized presentation    | 21.279 ms |
| Undo + localized presentation      | 17.749 ms |

Resource facts from the same run:

```text
Terraform line objects       16
Terraform geometries         16
Shared material count         1
Geometry buffer bytes   655,008
```

Browser interaction reference from the same hosted-runner evidence:

```text
Pointer -> visible preview      383.1 ms
Tap -> visible Terrain update  1142.0 ms
Observed JS heap             27,600,000 bytes
Terrain render sectors               64
Undo depth after measured commit       1
```

### Local post-merge baseline

Measured on `master@ece3fe8e` after the production merge:

```text
Raise 1×1 planning                  0.390 ms
Raise 3×3 planning                  0.319 ms
Raise 5×5 planning                  0.086 ms
Flatten planning                    0.078 ms
Overlay construction                0.267 ms
Initial unlocked-grid construction 23.307 ms
Overlay rebuild — 1 logical chunk   1.370 ms
Overlay rebuild — 2 logical chunks  1.969 ms
Overlay rebuild — 4 logical chunks  3.749 ms
Commit + localized presentation    12.848 ms
Undo + localized presentation      10.600 ms
Pointer -> visible preview          148.3 ms
Tap -> visible Terrain update       418.8 ms
Observed JS heap                 29,400,000 bytes
```

Headless browser measurements must not be interpreted as player-device FPS or latency acceptance.

## Lifecycle soak acceptance

The Terraform lifecycle soak exercises 20 alternating Load/Resume cycles with activation, preview, close/reactivation, periodic edit/save paths, disposal and IndexedDB cleanup.

Accepted invariants:

```text
20 alternating Load/Resume cycles              PASS
single live canvas                              PASS
single Terraform overlay root                   PASS
Undo starts empty for each restored session     PASS
listener ownership stable while live            PASS
listeners return to zero after exit             PASS
requestAnimationFrame count returns to zero     PASS
periodic edit + save paths                       PASS
IndexedDB deletion after final disposal          PASS
page/runtime errors                              NONE
```

Evidence:

```text
Final pre-merge Terraform Hardening  PASS — run 33369754789
Post-merge Terraform Hardening       PASS — run 33372507253
Fresh local post-merge soak          PASS — 20 cycles / 1 passed
```

## Persistence authority

The browser persistence test proves the production path:

```text
Terraform edit
  -> Terrain canonical revision/elevation changes
  -> Save captures existing CitySaveV1.terrainSnapshot
  -> Load restores the exact saved Terrain chunks/revision
  -> Terraform Undo history starts fresh
```

No `terraformSnapshot` property is introduced.

## Frozen v1 interaction semantics

```text
Operations       Raise / Lower / Flatten
Brushes          1×1 / 3×3 / 5×5 gameplay cells
Strengths        Fine 0.25m / Normal 1m / Strong 4m
Default          Raise + 1×1 + Normal
Flatten          first valid tap selects canonical reference; no mutation
Commit signal    City Input semantic onTap only
Navigation       drag / right-drag / wheel / multi-touch never commit Terraform
Undo             same live session only; revision-safe; reset on Load/Resume
Persistence      Terrain snapshot only
```

## Closed phase status

```text
TF1 Core                         CLOSED
TF2 Mutation + Undo              CLOSED
TF3 Three.js Presentation        CLOSED
TF4 Mouse/Touch                  CLOSED
TF5 Production UI                CLOSED
TF6 Persistence + Browser E2E    CLOSED
TF7 Hardening                    CLOSED
Post-merge Verification          CLOSED
```

## Reopen criteria

Terraform v1 may be reopened only for:

1. A correctness regression against frozen Terraform semantics.
2. A save/load defect that risks canonical Terrain data.
3. A camera or multi-touch gesture that commits Terraform unexpectedly.
4. An Undo correctness defect that corrupts Terrain or revision synchronization.
5. A Terraform-owned lifecycle/resource leak.
6. A reproducible performance regression against a future explicitly adopted threshold.

Smooth/Slope/Redo, Economy, Roads, Water/Hydrology, Ground/Environment integration and other future gameplay expansion are separate follow-on work and do not silently change Terraform v1.

## Closure-record publication gate

This closure-record change is documentation-only. After publication it must retain a clean working tree and pass fresh exact-head CI + Terraform Hardening. No pre-merge result is reused as post-merge evidence.
