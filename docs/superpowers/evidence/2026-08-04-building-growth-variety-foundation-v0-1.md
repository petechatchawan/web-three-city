# Building Growth & Variety Foundation v0.1 Evidence

## Status

Implementation and automated verification are complete. The runtime source fix was verified from a clean committed tree, including the complete Playwright suite. PR #23 remains **Draft / Open / Unmerged** pending Owner manual acceptance and explicit merge authorization.

## Stacked delivery

1. `agent/building-growth-core-v0-1`
2. `agent/building-content-variety-v0-1`
3. `agent/building-growth-runtime-v0-1`

## Automatic Growth interaction isolation

Automatic Growth is now separated from the interactive Building tool lifecycle:

- the Simulation scheduler calls `GameRuntime.runBackgroundGrowthTick()` directly;
- the runtime delegates to the atomic `executeWorldGrowthTick()` transaction;
- automatic Growth does not call `planBuildingDevelopment()` or `commitBuildingPlan()`;
- automatic Growth does not click the hidden `Develop Zones` control;
- automatic Growth does not dispatch synthetic pointer events;
- automatic Growth does not select `Navigate` before or after a tick;
- automatic Growth does not dispatch interactive Building transaction-state events;
- automatic Growth does not overwrite player-facing status or Undo availability;
- Residential, Commercial, Industrial, Remove Zone, Road, Terraform, or another active tool remains selected;
- an in-progress Zoning stroke remains active while Growth starts Construction;
- the explicit `Develop Zones` control remains hidden in production.

## Automated acceptance matrix

| Area | Required evidence | Result |
| --- | --- | --- |
| Simple calendar | Y1/M1/D1 08:00 and exact 24/30/12 boundaries | PASS |
| Tick mutation | exactly one hour per logical tick with stale fencing | PASS |
| Speeds | Paused, Normal, 2×, 4×, exact paused Step | PASS |
| Growth cadence | one start maximum at 00:00/06:00/12:00/18:00 | PASS |
| Background isolation | active tool and in-progress Zoning stroke survive Growth without interactive UI events | PASS |
| Lifecycle | Construction completion before new start | PASS |
| Variety | exact twelve-definition catalog and deterministic weighted selection | PASS |
| Duplicate avoidance | adjacent matching Definition filtered when an alternative exists | PASS |
| Presentation | foundation, frame, shell, and twelve active prototypes | PASS |
| Undo | automatic ticks preserve player Undo; Building bulldoze restores lifecycle | PASS |
| Save/Load | WorldSaveV4, BuildingSaveV2, SimulationSaveV1 | PASS |
| Migration | WorldSaveV1–V3 deterministic migration | PASS |
| Browser | Growth acceptance and responsive visual evidence | PASS |
| Repository | formatting, lint, typecheck, provenance, tests, build, clean tree | PASS |

## Automated verification record

Verified implementation source commit:

`0f2572d6d7fd219fb74fa7b3d6409ce630903658`

Clean committed-tree verification:

- verification run: `30987800318`;
- verification job: `92246519161` — PASS;
- `pnpm verify:full` — PASS;
- Playwright Chromium: **117/117 passed using exactly 2 workers in 10.6m**;
- regression `automatic Growth preserves the active Zoning tool and in-progress stroke` — PASS;
- production control `does not expose the explicit Develop Zones control in production Growth mode` — PASS;
- working tree verification — clean;
- formatting, ESLint, workspace and browser TypeScript — PASS;
- provenance: 367 source files — PASS;
- Simulation Core: 8/8 — PASS;
- Building Core: 27/27 — PASS;
- Building Three: 5/5 — PASS;
- Game: 184/184 — PASS;
- deployment and verification scripts: 16/16 — PASS;
- all workspace builds — PASS.

Verified fix artifact:

- artifact: `verified-background-growth-isolation`;
- artifact ID: `8923126013`;
- SHA-256: `6e0b28f0eb950507e3ab4c2a25280bdcb1f66e1539b3220d7ef4097e81418015`.

The current exact PR-head CI run and browser-evidence artifact are recorded in PR #23 so the immutable evidence document does not require another source change merely to embed its own final commit SHA.

## Final verification command

```bash
pnpm verify:full
```

This command performs the frozen install, formatting, lint, workspace and browser typechecking, provenance, all unit and deployment tests, all builds, Playwright Chromium tests, and clean-worktree verification. Partial command success does not close the milestone.

## Owner manual acceptance

- [ ] New Game begins at Y1 M1 D1 08:00.
- [ ] Pause prevents time advancement.
- [ ] Step advances exactly one in-game hour and remains paused.
- [ ] Normal, 2×, and 4× are visibly selectable.
- [ ] Zoned lots begin Construction automatically at evaluation hours.
- [ ] No more than one Building starts per evaluation.
- [ ] Residential or Industrial remains selected when automatic Growth occurs.
- [ ] An active Zoning drag/stroke is not canceled when automatic Growth occurs.
- [ ] Status does not change to `Zones developed` during automatic Growth.
- [ ] Foundation, frame, shell, and Active visuals are distinguishable.
- [ ] Residential, Commercial, and Industrial each show multiple silhouettes.
- [ ] Construction and Active Buildings can be bulldozed.
- [ ] Undo restores the exact prior Building lifecycle.
- [ ] Save during Construction loads at the exact tick and starts paused.
- [ ] Hidden-tab time does not catch up.
- [ ] Time controls remain reachable on mobile viewport.

## Closure state

- Automated implementation acceptance: PASS
- Repository cleanup: PASS
- Owner manual acceptance: Pending
- Explicit merge authorization: Pending
- PR #23: Draft / Open / Unmerged

## Merge order after acceptance

1. PR #20 — Planning/specification
2. PR #21 — Simulation Clock & Building Growth Core
3. PR #22 — Building Content Variety
4. PR #23 — Runtime, Save V4, UI & browser integration
