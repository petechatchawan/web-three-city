# Terraform v1 Production Closure

- **Status at this commit:** PRE-MERGE VERIFIED
- **Evidence date:** 2026-08-31
- **Implementation baseline:** `1a80f2d037ac34edf62598492f800824de8f5ba7`
- **Pull request:** #123
- **Owner:** `systems/terraform` with application composition in `apps/game`

## Closure decision

Terraform v1 is ready for the final exact-head merge and post-merge verification gate. TF4–TF7 complete the production interaction path on top of the already-closed TF1–TF3 foundation without creating a second Terrain authority.

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

The repository contains no Sonar workflow or `sonar-project.properties`; the currently visible `SonarCloud Code Analysis` check is emitted by the external SonarQubeCloud GitHub App. That external check is informational/non-gating until Sonar is explicitly re-enabled by a later owner decision. The GitHub App installation itself is account/repository integration state outside this repository and is not used as closure evidence here.

## Pre-merge release evidence

Exact implementation SHA:

```text
1a80f2d037ac34edf62598492f800824de8f5ba7
```

Remote evidence on that exact SHA:

```text
PR #123
PR CI                    PASS — run 33368483265
Push CI                  PASS — run 33368441018
Terraform Hardening      PASS — run 33368483274
Terrain Hardening        PASS — run 33368483214
Architecture             PASS — 7 packages / 126 edges / 0 violations
Tracked worktree         CLEAN
```

Terraform Hardening run `33368483274` verified exact HEAD before executing the repository verification, performance baseline, lifecycle soak, clean-worktree check and artifact upload.

## Automated verification

The exact implementation head passed:

```text
Terraform package tests   53 / 53
Game tests                49 passed / 2 opt-in performance tests skipped
Browser suite             20 passed / 4 hardening-only tests skipped
Architecture check        7 packages / 126 edges / 0 violations
Production build          PASS
Formatting                PASS
Lint                      PASS
Typecheck                 PASS
```

Browser coverage includes mouse commit/navigation precedence, touch takeover, Flatten reference semantics, Undo, save/load exact Terrain persistence, mobile viewport behavior, disposal and existing Terrain regressions.

## GitHub-runner performance baseline

Measured in Terraform Hardening run `33368483274` on the GitHub-hosted Ubuntu runner. These values are regression references only; Terraform v1 does not adopt performance thresholds from these measurements.

### Node / composition baseline

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

### Browser interaction baseline

```text
Pointer -> visible preview      383.1 ms
Tap -> visible Terrain update  1142.0 ms
Observed JS heap             27,600,000 bytes
Terrain render sectors               64
Undo depth after measured commit       1
```

The browser baseline uses headless CI graphics characteristics and must not be interpreted as player-device FPS or latency acceptance.

## Lifecycle soak acceptance

Terraform Hardening run `33368483274` executed the 20-cycle browser soak and completed successfully:

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

The soak test result was `1 passed` in approximately 5.4 minutes on the hosted runner.

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

## Reopen criteria

Terraform v1 may be reopened only for:

1. A correctness regression against frozen Terraform semantics.
2. A save/load defect that risks canonical Terrain data.
3. A camera or multi-touch gesture that commits Terraform unexpectedly.
4. An Undo correctness defect that corrupts Terrain or revision synchronization.
5. A Terraform-owned lifecycle/resource leak.
6. A reproducible performance regression against a future explicitly adopted threshold.

Smooth/Slope/Redo, Economy, Roads, Water/Hydrology, Ground/Environment integration and other future gameplay expansion are separate follow-on work and do not silently change Terraform v1.

## Final closure gate

Production closure is declared only after the documentation candidate head passes fresh exact-head CI + Terraform Hardening, merges with the expected SHA, and the resulting `master` receives fresh post-merge CI + Terraform Hardening evidence. Pre-merge evidence above must not be reused as post-merge evidence.
