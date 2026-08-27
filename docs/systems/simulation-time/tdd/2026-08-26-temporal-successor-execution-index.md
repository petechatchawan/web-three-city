# Temporal Authority & Simulation Clock v1 — Execution Index

**Status:** T1–T4 merged; T4.1 Playback Scheduler vNext is the current implementation slice; T5–T7 not started
**Baseline:** `master@d170a473205bc080bdd70c31fd21ac868c8a7118`
**Planning PR:** #94

## Locked owner decisions

1. `AbsoluteGameMinute` remains the sole mutable world-calendar authority.
2. Compressed calendar is `60 GameMinutes/hour`, `24 hours = 1 Simulation Cycle = 1 Calendar Month`, `12 months/year`.
3. T4 retained the merged nominal pacing, but T4.1 now supersedes only that throughput table: x1 `0.500s`, x2 `0.250s`, x4 `0.125s` per GameMinute. The rejected `3.000/1.500/0.750` proposal remains rejected. T4.1 is the approved faster/slower tuning decision.
4. V8 -> V9 uses **authority continuity**: preserve `AbsoluteGameMinute` 1:1 and accept that legacy calendar labels are reprojected under the new calendar.
5. RCI age-bearing state is not allowed to jump by 30x at migration. Canonical time remains 1:1, while age-origin fields such as citizen birth time are remapped by an explicit checked migration so age-years/fraction at the cutover is preserved under the new 12-cycle year. Other RCI timestamp classes remain 1:1 only after field-by-field semantic proof.
6. Building construction durations, Growth boundaries, Economy settlement cadence, Mobility schedule cycle, Traffic four-quanta cadence, routing, physical behavior, world transaction order, and revision semantics are not sped up or divided by playback multipliers.
7. Successful automatic minute remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, revision `+5`, one final presentation and one external world notification. Rejection remains fail-stop and atomic.

## Delivery order

Execute only one GREEN candidate at a time. Each PR starts from current `master`, performs local RED -> GREEN, runs affected verification, `pnpm check`, clean-worktree review, then non-force pushes the GREEN candidate for exact-head CI/Sonar.

| Slice | System scope | Plan | Release requirement |
| --- | --- | --- | --- |
| T1 | Simulation Time + architecture tooling | `2026-08-26-t1-explicit-temporal-units.md` | unit/architecture contracts GREEN |
| T2A | Buildings | `../../buildings/tdd/2026-08-26-building-temporal-contract-migration.md` | Building semantic parity GREEN |
| T2B | RCI | `../../rci/tdd/2026-08-26-rci-temporal-calendar-migration.md` | age/hazard/cycle semantics GREEN |
| T2C | Economy | `../../economy/tdd/2026-08-26-economy-temporal-contract-migration.md` | cycle settlement parity GREEN |
| T3A | Citizen Mobility | `../../citizen-mobility/tdd/2026-08-26-mobility-temporal-contract-migration.md` | schedule parity GREEN |
| T3B | Traffic | `../../traffic/tdd/2026-08-26-traffic-temporal-contract-migration.md` | four-quanta parity GREEN |
| T4 | Simulation calendar + initial playback policy | `2026-08-26-t4-compressed-calendar-playback.md` | calendar rollover GREEN (merged) |
| T4.1 | Playback Scheduler vNext | `2026-08-27-playback-scheduler-vnext.md` | 2/4/8 GameMinutes/s with bounded catch-up and rejection GREEN |
| T5 | World persistence | `../../world/tdd/2026-08-26-world-save-v9-temporal-calendar-migration.md` | V1-V8 golden migration + V9 roundtrip GREEN; blocked on T4.1 |
| T6 | Game/UI/release cutover | `2026-08-26-t6-game-ui-release-cutover.md` | targeted browser + full release gates + Owner acceptance |
| T7 | Cross-system cleanup | executed only after T1-T6 merge | no legacy ambiguous temporal public names/escapes remain |

## Dependency graph

```text
T1 explicit units
  |\
  | +--> T2A Buildings
  | +--> T2B RCI
  | +--> T2C Economy
  | +--> T3A Mobility
  | +--> T3B Traffic
  |          |
  +----------+
             v
       T4 calendar policy
             |
             v
       T4.1 playback scheduler
             |
             v
       T5 WorldSaveV9
             |
             v
       T6 Game/UI/release
             |
             v
       T7 legacy cleanup
```

T2A/T2B/T2C may be separate PRs after T1. T3A and T3B should remain separate unless the implementation proves they cannot be independently GREEN. T4 must not begin until RCI/Economy semantics are explicit because the compressed calendar changes their calendar interpretation.

## Global stop conditions

Stop and return to design review if any slice requires:

- a second mutable world clock;
- a `simulation-core -> domain` dependency;
- weakening five-phase transaction validation or revision order;
- changing Traffic quanta, routing, caps, Road authority, rendering policy, or physical semantics;
- changing the approved T4.1 playback rates, cap, backlog, or rejection semantics without a new owner decision;
- silently reinterpreting V1-V8 temporal fields without a golden migration rule;
- an RCI age migration that changes a citizen's cutover age rather than preserving it;
- force-push, intentional remote RED, or merging a successor PR without exact-head gates.

## Final release verification

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
pnpm build:browser
pnpm test:browser:only --grep '@building|@rci|@traffic|@interaction'
git diff --check
node tooling/verify-clean-worktree.mjs
```

`pnpm verify:full` is a final/shared-release escalation, not the first debugger. Browser evidence proves browser behavior only. Owner Visual on canonical 414x896 remains human authority for the final UX cutover.
