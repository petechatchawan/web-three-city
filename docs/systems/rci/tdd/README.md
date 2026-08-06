# RCI Demand & Occupancy v0.1 — TDD Implementation Packet

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to execute each plan task-by-task. Every production change follows RED → GREEN → REFACTOR → focused verification → commit.

**Status:** Ready for implementation-plan review  
**Approved specification:** [`../specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md`](../specs/2026-08-06-rci-demand-occupancy-foundation-v0-1.md)  
**Owning system:** [`../README.md`](../README.md)

## Purpose

This directory decomposes the approved RCI foundation into six sequential, independently reviewable implementation pull requests. Each plan names exact files, public interfaces, focused tests, commands, commit checkpoints, living-document updates, and verification evidence.

The plans deliberately avoid a single oversized implementation branch. Merge each PR before starting the next so every branch begins from verified `master` and later plans consume contracts that already exist.

## Execution order

| Order | Plan | Delivered boundary | Depends on |
|---:|---|---|---|
| 1 | [Core contracts, registries, snapshots, and Save V1](2026-08-06-rci-pr1-core-contracts-snapshots-save-v1.md) | `rci-core` package, normalized records, registries, validation, canonical serialization, `WorldSaveV5` foundation | approved docs only |
| 2 | [Population, relationships, households, and daily lifecycle](2026-08-06-rci-pr2-population-relationships-lifecycle.md) | Citizens, membership history, family graph, qualifications, deterministic aging/birth/death | PR 1 |
| 3 | [Housing, migration, relocation, and displacement](2026-08-06-rci-pr3-housing-migration-displacement.md) | Dwelling inventory, housing assignments, incoming requests, relocation, displaced queue, housing pressure | PR 2 |
| 4 | [Workplaces and employment reconciliation](2026-08-06-rci-pr4-workplaces-employment.md) | Workplace inventory, position groups, assignments, stability-first matching, controlled upgrades | PR 3 |
| 5 | [Demand and building-growth policy](2026-08-06-rci-pr5-demand-growth-policy.md) | Fixed-point R/C/I demand, smoothing, persisted hysteresis gates, caller-supplied growth policy | PR 4 |
| 6 | [Atomic game integration, HUD, browser acceptance, and final verification](2026-08-06-rci-pr6-game-integration-hud-verification.md) | End-to-end world tick, final V5 save/load, HUD, browser scenarios, benchmark evidence, closure | PR 5 |

## Branch and review policy

Use one branch per plan:

```text
feat/rci-core-contracts-v0-1
feat/rci-population-lifecycle-v0-1
feat/rci-housing-migration-v0-1
feat/rci-employment-v0-1
feat/rci-demand-growth-v0-1
feat/rci-game-integration-v0-1
```

Rules:

1. Branch from freshly synchronized `master` after the preceding PR merges.
2. Use an isolated Git worktree before implementation.
3. Keep the PR Draft while RED/GREEN tasks remain incomplete.
4. Do not combine tasks from a later plan into the current PR.
5. Update `docs/systems/rci/README.md` in the same PR whenever delivered status, authority, persistence, integration, or limitations change.
6. Add one evidence record under `docs/systems/rci/verification/` before declaring a PR complete.
7. Preserve exact public signatures once a dependent PR has merged; changing them requires updating every downstream plan and affected tests.

## Global architecture constraints

- `@web-three-city/rci-core` may depend on `building-core`, `simulation-core`, `world-core`, and type-only zone contracts where necessary.
- `building-core` and `simulation-core` must never import `rci-core`.
- `rci-core` contains no DOM, Three.js, browser globals, wall-clock access, locale-dependent ordering, `Math.random()`, mutable singletons, or UI logic.
- Inputs and outputs are immutable. Plan functions never mutate committed snapshots.
- One fact has one authority. Current household, home, work, qualification, histograms, vacancies, and HUD totals are derived from normalized history.
- Generated IDs use persisted monotonic sequences. Failed plans consume no sequence values.
- Order-sensitive work sorts by explicit stable comparators before decisions.
- Demand, pressure, weights, and probability comparisons use integer fixed-point values.
- Untrusted Save decode returns `Result`; stale or invalid commit misuse throws typed contract errors.
- Every cross-domain tick is staged and validated before committed snapshots are replaced.
- Background growth must not alter the active tool, input preview, pointer session, undo history, or HUD mode.

## Repository conventions

The new package follows existing core-package structure:

```text
packages/rci-core/
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
├─ vitest.config.ts
├─ src/
└─ test/
```

Workspace discovery requires no `pnpm-workspace.yaml` change because `packages/*` is already included.

Focused package commands:

```bash
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core build
```

Repository gates required on every implementation PR:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
```

Final PR additionally runs:

```bash
pnpm verify:full
```

## Shared test rules

Every planner or serializer that depends on ordering must include all of these tests:

1. Same input twice produces deeply equal plans, receipts, and snapshots.
2. Permuted authoritative arrays produce identical canonical Save output.
3. Invalid or stale plans leave the original snapshots and sequence counters unchanged.
4. Continuous execution equals encode → decode → resume execution.
5. Tests use explicit fixture registries and deterministic seeds; no test relies on ambient time or random globals.

## Completion definition

The packet is complete only after all six PRs are merged, `docs/systems/rci/README.md` reports `Implemented`, `WorldSaveV5` is the current world envelope, browser acceptance passes, final verification evidence records exact commit/test results, and no active-tool regression exists.