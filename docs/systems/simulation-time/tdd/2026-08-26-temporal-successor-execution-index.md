# Temporal Authority & Simulation Clock v1 — Execution Index

**Status:** ACTIVE — T1/T2/T3A/T3B merged; combined T3 source state closed; T4 ready for local RED/GREEN execution; T5–T7 implementation plans frozen  
**Current verified execution baseline:** `master@1e071455a50aa45e26bb3d966ca7daa02586ce7e`  
**Planning-freeze branch:** `docs/temporal-t3b-t7-planning-freeze`

## Locked owner decisions

1. `AbsoluteGameMinute` remains the sole mutable world-calendar authority.
2. Compressed calendar is `60 GameMinutes/hour`, `24 hours = 1 Simulation Cycle = 1 Calendar Month`, `12 months/year`.
3. Playback retains merged nominal pacing: x1 `1.000s`, x2 `0.500s`, x4 `0.250s` per GameMinute. Faster/slower tuning is a separate product decision.
4. V8 -> V9 uses authority continuity: preserve `AbsoluteGameMinute` 1:1 and reproject legacy calendar labels under the compressed calendar.
5. RCI age-bearing state must not jump at migration. Legacy age origin uses the approved checked 8640->288 macro-hour/year mapping relative to current macro hour; non-age fields follow field classification.
6. Building construction/Growth boundaries, Economy settlement cadence, Mobility schedule cycle, Traffic four-quanta cadence, routing, physical behavior, world transaction order, and revision semantics are not rescaled by playback or calendar labels.
7. Successful automatic minute remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, revision `+5`, one final presentation and one external world notification. Rejection remains fail-stop and atomic.
8. WorldSaveV9 target remains `SimulationSaveV4 + BuildingSaveV3 + RciSaveV2 + EconomySaveV2 + MobilitySaveV3 + TrafficSaveV3` with V1–V9 read support.
9. Automatic Growth remains ON.
10. `23:59 -> 00:00` is a first-class regression boundary through T3–T7.

## Integrated baseline already complete

| Slice | Integration result | Evidence state |
| --- | --- | --- |
| T1 Explicit Temporal Units | PR #95 merged -> `b25cc5cfa9510e812ff77d1e87ff07b000e47282` | exact-head CI/Browser/Sonar GREEN |
| T2A Buildings | PR #96 merged -> `298c3cbad454f184b35ce913f42977ef205e8aaa` | macro-hour lifecycle parity GREEN |
| T2B RCI | PR #97 merged -> `b1ead705ae4942a1c1f81bdc62c2d9d3cc123220` | age/hazard/cycle + combined T2A/T2B GREEN |
| T2C Economy | PR #98 merged -> `2e4757da365afa759a11dd6ca0f0c00aaa9c755e` | Economy + combined T2A/T2B/T2C GREEN |
| T3A Citizen Mobility | PR #99 merged -> `4a9ca6c18a4360d9576db8c5ab55c69f64e20cd7` | Mobility schedule-cycle parity + exact-head CI/Full Browser/Sonar GREEN |
| T3B Traffic | PR #100 merged -> `1e071455a50aa45e26bb3d966ca7daa02586ce7e` | Traffic 78, Game 409, Traffic Three 40, deployment 109/109, temporal architecture 7/7, Full Browser 149/1 policy skip, exact-head CI #33064621839, Sonar GREEN |

The T3B squash commit has repository tree `b182f28ddc78d15e9ac9987c988cad3d4b0821e0`, identical to exact-tested PR head `9a56405512b54932d36edbf1492f58880c050878`. Combined T3A + T3B source-state closure is therefore exact-tree proven on `master@1e071455...`.

## Remaining delivery order

Execute one GREEN candidate at a time. Every implementation branch starts from the **current master after its predecessor has merged**.

| Slice | System scope | Plan | Current status | Release requirement |
| --- | --- | --- | --- | --- |
| T3A | Citizen Mobility | `../../citizen-mobility/tdd/2026-08-26-mobility-temporal-contract-migration.md` | **MERGED** via PR #99 | GREEN |
| T3B | Traffic | `../../traffic/tdd/2026-08-26-traffic-temporal-contract-migration.md` | **MERGED** via PR #100 | GREEN; combined T3 exact-tree closure complete |
| T4 | Simulation calendar/playback | `2026-08-26-t4-compressed-calendar-playback.md` | **READY FOR LOCAL EXECUTION** from `master@1e071455...`; no production implementation started yet | compressed rollover + unchanged playback + V8 authority continuity GREEN |
| T5 | World persistence | `../../world/tdd/2026-08-26-world-save-v9-temporal-calendar-migration.md` | **PLAN FROZEN**; blocked on T4 merge | V1–V9 read, V9 writer, golden migration + continuation GREEN |
| T6 | Game/UI/release cutover | `2026-08-26-t6-game-ui-release-cutover.md` | **PLAN FROZEN**; blocked on T5 merge | full product/release gates + human Owner 414×896 PASS |
| T7 | Cross-system legacy cleanup | `2026-08-27-t7-legacy-temporal-cleanup.md` | **PLAN FROZEN**; blocked on T6 acceptance | zero active legacy temporal seams; old save readers preserved; all gates GREEN |

## Planning Freeze Rules

The branch `docs/temporal-t3b-t7-planning-freeze` is documentation-only. It is synchronized onto the post-T3B master tree and contains the frozen T3B–T7 implementation plans without production changes.

Current transition rule:

```text
T3A merged
  -> T3B merged + combined T3 exact-tree closure
  -> planning branch synchronized onto post-T3B master
  -> source-aware T4 audit
  -> create T4 from exact current master
  -> T4 local characterization + RED/GREEN
  -> exact-head gates
  -> merge T4
  -> only then begin T5
```

The planning branch does not need to be merged into master merely to execute the successor slices; executors may read frozen plans from the planning branch while implementation branches remain based exactly on current `master`.

## Successor branch topology

```text
master + T3A + T3B 1e071455...
        |
        +-- T4 Compressed Calendar   [next]
                |
                v merge
          master + T4
                |
                +-- T5 WorldSaveV9
                        |
                        v merge
                  master + T5
                        |
                        +-- T6 Release Cutover
                                |
                                v merge + Owner PASS
                          master + T6
                                |
                                +-- T7 Legacy Cleanup
                                        |
                                        v
                            Temporal Authority v1 CLOSED
```

T4 starts only after combined T3 proof, which is now complete. T5 must not begin before T4 because V9 identifies the final compressed-calendar interpretation. T7 must not begin before T6 release acceptance because it deletes only compatibility surfaces proven unnecessary to the accepted product path.

## Per-PR execution discipline

For every remaining slice:

```text
current master
-> isolated branch/worktree
-> local characterization where required
-> local RED for changed behavior/contract
-> minimal GREEN
-> owner tests
-> affected consumers
-> pnpm test:deployment
-> pnpm check
-> affected plan
-> Browser only as authority/resolver requires
-> git diff --check + clean tracked worktree
-> push GREEN candidate only
-> exact-head GitHub Actions + Sonar
-> Ready/merge only after explicit release gate
```

Never intentionally push known-failing RED. CI verifies the local GREEN candidate; it is not the first debugger.

## T4 immediate execution baseline

```text
T4_BASE_SHA=1e071455a50aa45e26bb3d966ca7daa02586ce7e
branch=feat/t4-compressed-calendar-projection
plan=docs/systems/simulation-time/tdd/2026-08-26-t4-compressed-calendar-playback.md
```

Before the first production edit, reconfirm the post-T3B calendar/presentation/Economy/save/browser source inventory. If topology materially differs, update only the affected file list and stop for design review if semantics would broaden.

## Global stop conditions

Stop and return to design review if any slice requires:

- a second mutable world clock;
- a `simulation-core -> domain` dependency;
- weakening five-phase transaction validation or revision order;
- changing Traffic quanta, routing, caps, Road authority, rendering policy, or physical semantics;
- changing playback away from `1.000/0.500/0.250` without a new owner decision;
- silently reinterpreting V1–V8 temporal fields without a golden migration rule;
- an RCI age migration that changes cutover age/band rather than preserving it;
- removing a V1–V8/domain legacy reader required for WorldSave compatibility;
- renaming the persistent save storage address without an explicit dual-read migration decision;
- pulling T5 writer work into T4 or T7 cleanup into T6 merely for naming convenience;
- force-pushing a normal GREEN candidate, intentional remote RED, or merging a successor without exact-head gates.

## Final program verification

At T7 closure the deterministic minimum is:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
node --test tooling/temporal-unit-boundary.test.mjs
node --test tooling/temporal-legacy-surface.test.mjs
pnpm test:deployment
pnpm check
git diff --check
node tooling/verify-clean-worktree.mjs
```

Browser authority follows the resolver/release policy; architecture-tooling changes normally imply conservative escalation. T6 Owner Visual on canonical `414×896` remains the human product authority for the final UI cutover. T7 needs a new Owner Visual pass only if cleanup unexpectedly changes rendered behavior.
