# Development Workflow System Improvement v0.1 — Verification

**Status:** Final candidate ready for exact-head verification  
**System:** `development-workflow`  
**Date:** `2026-08-07`

## Delivered Contracts

- package-targeted inner loop and Vitest watch scripts;
- staged-only Prettier/ESLint pre-commit guard;
- normative root `AGENTS.md` with Level 0–4 escalation and the explicit static Level 2 map;
- GitHub Bug Issue Form and PR Definition of Done template;
- `master` trunk workflow and repaired system registry;
- same-PR living documentation and exact-head CI evidence policy.

## TDD Evidence

Tasks 1–5 were executed test-first. Missing-contract RED states were observed before the corresponding implementation was added.

- **Task 1:** the workflow contract test failed while root fast-loop scripts and workspace `test:watch` contracts were absent, then passed after the root and 17 Vitest workspace manifests were updated.
- **Task 2:** the pre-commit contract failed before Husky/lint-staged configuration existed. `pnpm add -Dw husky lint-staged` generated the dependency/lockfile state. A disposable staged TypeScript fixture was run through `pnpm exec lint-staged`, auto-formatted successfully, then removed with no fixture residue. Husky `prepare` also completed successfully.
- **Task 3:** an initial test-harness JavaScript escape error was corrected before accepting RED evidence. The corrected RED run then passed the pre-existing gates and failed only because root `AGENTS.md` was absent. CI run `31161077010` supplied that valid RED; CI run `31161361495` supplied GREEN after the normative guide and full 15-row static map were added.
- **Task 4:** CI run `31161548118` failed only on the missing Bug Issue Form / PR template contracts. After the two contribution surfaces were added and repository YAML formatting was corrected, CI run `31162164638` passed.
- **Task 5:** CI run `31162370135` passed formatting, lint, typecheck, provenance, workspace tests, and the Task 1–4 contracts, then failed only on the stale `develop` workflow and stale system registry assertions. After both documents were corrected, CI run `31162632284` passed.

## Pre-Candidate Verification

The most recent pre-candidate repository gate before this handoff commit is CI run `31162632284` on implementation head `b3c1d6d26654787659476cb1dfe25bc1bebee401`.

```text
Node 22.23.2 — PASS
pnpm 10.13.1 — PASS
pnpm install --frozen-lockfile — PASS
Husky prepare lifecycle — PASS
pnpm check — PASS
format:check — PASS
ESLint — PASS
workspace + browser TypeScript — PASS
provenance — PASS (469 source files)
RCI core — PASS (35 files / 85 tests)
Game — PASS (47 files / 197 tests)
repository/deployment contracts — PASS (27/27)
workspace builds — PASS
```

The Task 1 implementation loop also ran the representative `@web-three-city/rci-core` test/typecheck surface and one-shot `test:watch -- --run` successfully. Exact final-candidate Level 1 evidence is recorded in PR #35 after the final candidate is established.

A `master...HEAD` changed-file review before this handoff showed only repository/workflow manifests and configuration, `.github`, `.husky`, `AGENTS.md`, package manifests, lockfile, tooling contracts, and workflow/system documentation. No file under `apps/game/src/` or `packages/*/src/` changed.

## Exact-Head Evidence Policy

The final candidate SHA, CI run IDs, artifact IDs, Playwright count, clean-worktree result, and other post-run exact-head metadata are recorded in PR #35 body/comments after the candidate is verified. They are not committed solely to mutate this record after verification.

Any tree change after successful exact-head verification creates a new candidate and requires the relevant verification again.

## Acceptance

The milestone closes only when all of the following are true on the exact final candidate:

- workflow contract tests pass;
- the pre-commit staged-file smoke has passed with no residue;
- representative package-targeted tests and typechecks pass;
- Level 3 `pnpm verify` passes;
- Level 4 `pnpm verify:full` passes on the exact clean candidate head;
- no gameplay/runtime source changes were introduced;
- no commit is created after the accepted Level 4 run solely to add verification metadata.

## Deferred Scope

Only the approved v0.2/non-goal items remain: `game-bootstrap`/Application Layer refactoring, automatic affected/dependent graph tooling, Nx/Turborepo, browser sharding/tagging/parallelization redesign, and gameplay milestones such as Economy.
