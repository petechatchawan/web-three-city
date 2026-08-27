# T4.1 Playback Scheduler vNext — TDD Plan

**Base:** `master@d170a473205bc080bdd70c31fd21ac868c8a7118`
**Branch:** `feat/t4-1-playback-scheduler-vnext`
**Spec:** `../specs/2026-08-27-playback-scheduler-vnext.md`
**ADR:** `../adrs/0006-playback-scheduler-vnext.md`

## Scope

Change only `apps/game/src/simulation-runtime.ts` and its focused tests,
plus the living simulation-time documentation. Do not change Calendar,
Growth, domain durations, Traffic quanta, rendering, persistence, or UI
labels.

## Test-first sequence

1. Confirm the exact base, Node 22 environment, protected untracked plans,
   and baseline Game tests.
2. Extend runtime characterization for ordered minute/quantum emission,
   pause, step, reset behavior, sliced equivalence, and rejection.
3. Change the deterministic rate expectations to require 500/250/125ms
   per GameMinute. Confirm RED is caused by the old scheduler policy.
4. Add the eight-minute per-call cap and surplus-budget retention test.
5. Add multi-minute rejection coverage: two successful minutes remain
   committed, the third is atomic/rejected, later minutes do not run, and
   the runtime pauses with cleared accumulation.
6. Add calendar boundary projection coverage for month and year rollover
   while multiple sequential minute requests are emitted.
7. Implement the smallest explicit playback-rate policy and re-run focused
   GREEN tests.
8. Run affected Game, simulation-core, Traffic, deployment, and repository
   checks. Resolve the Selective Verification plan from the fixed base and
   honor any browser escalation.

## Required contracts

```text
normal 500ms -> 1 minute; 1000ms -> 2 minutes
fast   250ms -> 1 minute; 1000ms -> 4 minutes
faster 125ms -> 1 minute; 1000ms -> 8 minutes
```

`MAX_GAME_MINUTES_PER_ADVANCE = 8` limits work in one call only. A 10-second
x4 delta creates an 80-minute budget, processes eight minutes immediately,
and retains the remaining 72 minutes for later calls.

On rejection, prior complete minutes remain committed and no subsequent
minute is attempted. Playback pauses, the accumulator clears, and the
failure is not retried without explicit user action.

## Verification commands

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/simulation-runtime.test.ts \
  src/game-minute-transaction.test.ts \
  src/temporal-publication.test.ts
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/traffic-core test
pnpm test:deployment
pnpm check
pnpm verify:affected -- --base "$T4_1_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T4_1_BASE_SHA" --head HEAD --skip-browser
git diff --check
```

Finalization requires a clean tracked worktree, preservation of the two
pre-existing untracked plan files, non-force push only after local GREEN,
and exact-head CI/Sonar evidence. The PR remains Draft and is not merged by
this plan.

