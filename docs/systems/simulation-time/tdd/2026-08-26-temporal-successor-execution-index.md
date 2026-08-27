# Temporal Authority & Simulation Clock v1 — Execution Index

**Status:** ACTIVE — T1/T2 merged; T3A executing; T3B–T7 implementation plans frozen on a docs-only planning branch  
**Current verified planning baseline:** `master@2e4757da365afa759a11dd6ca0f0c00aaa9c755e`  
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

The current planning baseline is therefore the verified combined T2 tree at `2e4757da...`.

## Remaining delivery order

Execute one GREEN candidate at a time. Every implementation branch starts from the **current master after its predecessor has merged**, not from the planning-freeze baseline below.

| Slice | System scope | Plan | Current status | Release requirement |
| --- | --- | --- | --- | --- |
| T3A | Citizen Mobility | `../../citizen-mobility/tdd/2026-08-26-mobility-temporal-contract-migration.md` | **EXECUTING** on `feat/t3a-mobility-temporal-migration` from `2e4757da...` | schedule-cycle parity + exact-head gates GREEN |
| T3B | Traffic | `../../traffic/tdd/2026-08-26-traffic-temporal-contract-migration.md` | **PLAN FROZEN**; start only after T3A merge | explicit transport authority + combined T3 physical/save parity GREEN |
| T4 | Simulation calendar/playback | `2026-08-26-t4-compressed-calendar-playback.md` | **PLAN FROZEN**; no implementation started | compressed rollover + unchanged playback + V8 authority continuity GREEN |
| T5 | World persistence | `../../world/tdd/2026-08-26-world-save-v9-temporal-calendar-migration.md` | **PLAN FROZEN**; no implementation started | V1–V9 read, V9 writer, golden migration + continuation GREEN |
| T6 | Game/UI/release cutover | `2026-08-26-t6-game-ui-release-cutover.md` | **PLAN FROZEN**; no implementation started | full product/release gates + human Owner 414×896 PASS |
| T7 | Cross-system legacy cleanup | `2026-08-27-t7-legacy-temporal-cleanup.md` | **PLAN FROZEN**; no implementation started | zero active legacy temporal seams; old save readers preserved; all gates GREEN |

## Planning Freeze Rules

The branch `docs/temporal-t3b-t7-planning-freeze` is documentation-only and intentionally does not modify production source while T3A is executing.

Default integration rule:

```text
T3A local RED/GREEN
  -> exact-head gates
  -> merge T3A
  -> integrate/rebase planning docs onto new master
  -> create T3B from that current master
```

Do not merge the planning branch into master mid-T3A merely to make plans visible if doing so would force an otherwise unnecessary T3A rebase. The plans can be read directly from the planning branch until T3A closes.

## Successor branch topology

```text
verified T2 master 2e4757da...
        |
        +-- T3A Mobility  [currently executing]
                |
                v merge
          master + T3A
                |
                +-- T3B Traffic
                        |
                        v merge + combined T3 proof
                  master + T3A + T3B
                        |
                        +-- T4 Compressed Calendar
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

T3B is intentionally sequential after T3A because Game/Mobility/Traffic orchestration overlaps. T4 must not begin until combined T3 is proven. T5 must not begin before T4 because V9 identifies the final compressed-calendar interpretation. T7 must not begin before T6 release acceptance because it deletes only compatibility surfaces proven unnecessary to the accepted product path.

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
