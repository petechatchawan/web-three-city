# CI Topology Remediation

**Status:** CI-R1 through CI-R6 implemented and verified on exact hosted head `9fdea3c7769c4c22dfa2ac1d6429d0249aad25f3`
**System:** Development Workflow
**Scope:** GitHub Actions execution topology only

## Goal

Reduce pull-request wall-clock time by running the existing affected verification plan as independent non-browser lanes while keeping Browser verification dependent only on the exact Game/Terrain Lab artifact it consumes.

## Authority

`AGENTS.md` Level 0–4 is the only verification-level authority:

- L0 focused local iteration
- L1 owning package
- L2 affected consumers
- L3 repository/PR verification
- L4 Full Browser/full regression escalation

`GRAPH_SAFE`, `PARTIAL`, `GRAPH_BLIND`, and `GLOBAL` remain internal resolver risk signals. They do not define another verification hierarchy.

## Required topology

```text
Existing PR-T4 affected plan
        ├── changed-file lint
        ├── owner/related tests
        ├── affected consumers
        ├── affected typechecks
        └── deployment contracts

Existing PR-T4 affected plan
        └── Browser build → exact artifact → targeted Browser

Explicit Full Browser
        └── Browser build → exact artifact → two spec shards (1/2, 2/2)
```

Browser must not wait for the aggregate Lean check. Lean aggregates non-browser lanes and does not rerun them.

## Browser policy

Normal pull requests use the existing affected plan and targeted Browser authority when required. Full Browser remains an escalation/backstop. The initial Full Browser pilot uses two spec-file shards, one worker per shard, with an exact union equal to the serial baseline. `pnpm verify:full` remains the serial rollback and local release authority.

## Non-goals

- no production or gameplay changes;
- no Playwright assertion migration;
- no new classifier or verification-plan framework;
- no retry, worker, or timeout weakening;
- no WoC-specific merge-queue, long-simulation, or four/eight-shard rollout in this phase;
- no RCI, Growth, Zoning, Building, Water, or Terrain migration until this topology gate passes.

## Pilot evidence

The local Playwright discovery baseline is 137 Chromium tests in 33 spec files.
The hosted two-shard run produces 71 and 66 passing tests respectively, with an
exact 137-test union. Each hosted shard runs with `--workers=1`; no test assertion,
retry policy, or timeout was changed. Run `32640249302` completed in approximately
14m07s wall clock; shard runtimes were 11m32s and 13m34s (25m06s aggregate active
shard time). Artifacts are `9493546141` and `9493570625`. Sonar Quality Gate and
all affected verification lanes passed on the same exact head.
