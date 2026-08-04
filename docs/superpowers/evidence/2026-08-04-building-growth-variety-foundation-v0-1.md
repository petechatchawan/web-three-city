# Building Growth & Variety Foundation v0.1 Evidence

## Status

Implementation and test specifications are authored on three stacked Draft branches. Workspace lockfile reconciliation is complete. The first complete exact-head verification is starting; no merge is authorized.

## Stacked delivery

1. `agent/building-growth-core-v0-1`
2. `agent/building-content-variety-v0-1`
3. `agent/building-growth-runtime-v0-1`

## Automated acceptance matrix

| Area | Required evidence | Result |
| --- | --- | --- |
| Simple calendar | Y1/M1/D1 08:00 and exact 24/30/12 boundaries | Pending |
| Tick mutation | exactly one hour per logical tick with stale fencing | Pending |
| Speeds | Paused, Normal, 2×, 4×, exact paused Step | Pending |
| Growth cadence | one start maximum at 00:00/06:00/12:00/18:00 | Pending |
| Lifecycle | Construction completion before new start | Pending |
| Variety | exact twelve-definition catalog and deterministic weighted selection | Pending |
| Duplicate avoidance | adjacent matching Definition filtered when an alternative exists | Pending |
| Presentation | foundation, frame, shell, and twelve active prototypes | Pending |
| Undo | automatic ticks preserve player Undo; Building bulldoze restores lifecycle | Pending |
| Save/Load | WorldSaveV4, BuildingSaveV2, SimulationSaveV1 | Pending |
| Migration | WorldSaveV1–V3 deterministic migration | Pending |
| Browser | Growth acceptance and responsive visual evidence | Pending |
| Repository | formatting, lint, typecheck, provenance, tests, build, clean tree | Pending |

## Final verification commands

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
pnpm exec playwright install chromium
pnpm test:browser:only
node tooling/verify-clean-worktree.mjs
```

Partial command success cannot close the milestone. After any repair, rerun the complete gate from the exact final PR 3 head.

## Owner manual acceptance

- [ ] New Game begins at Y1 M1 D1 08:00.
- [ ] Pause prevents time advancement.
- [ ] Step advances exactly one in-game hour and remains paused.
- [ ] Normal, 2×, and 4× are visibly selectable.
- [ ] Zoned lots begin Construction automatically at evaluation hours.
- [ ] No more than one Building starts per evaluation.
- [ ] Foundation, frame, shell, and Active visuals are distinguishable.
- [ ] Residential, Commercial, and Industrial each show multiple silhouettes.
- [ ] Construction and Active Buildings can be bulldozed.
- [ ] Undo restores the exact prior Building lifecycle.
- [ ] Save during Construction loads at the exact tick and starts paused.
- [ ] Hidden-tab time does not catch up.
- [ ] Time controls remain reachable on mobile viewport.

## Exact-head closure record

- Final PR 3 head: Pending
- Verification run: Pending
- Playwright result: Pending
- Browser artifact: Pending
- Artifact digest: Pending
- Owner authorization: Pending
