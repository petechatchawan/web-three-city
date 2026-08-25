# Development Workflow System

**Status:** Implemented — Browser Verification Policy v0.2<br>
**System:** Development Workflow  
**Primary ownership:** repository root configuration, `.github/`, `AGENTS.md`, and development documentation  
**Persistence:** Git-tracked repository configuration and documentation only

## Purpose

Define the repository-owned development loop for humans and AI agents so changes can be located, implemented, verified, documented, and merged with fast feedback without weakening final safety gates.

## Current State

Development Workflow v0.2 makes verification proportional to the affected surface. Package-targeted Level 0/1 verification remains the default inner loop; Level 2 uses the conservative static consumer map; Level 3 `pnpm verify` remains the repository/tooling finalization gate.

Browser-observable changes now require targeted Playwright evidence for every affected browser path before PR readiness. Full Browser is not the default gate for every PR: the unfiltered Chromium suite is reserved for explicit Level 4 escalation such as release or milestone closure, shared browser infrastructure with an unbounded impact surface, an explicit `full-ci` PR label, manual workflow dispatch, and nightly scheduled regression.

For CI-backed targeted evidence, a PR may declare an approved union such as `Targeted browser tags: traffic building`. Browser CI targeted mode depends on Lean, validates the requested ownership tags against a fixed allowlist, consumes the exact Lean preview artifact, and runs only that Playwright union. Removing the PR-body metadata after evidence collection prevents later targeted reruns without changing the candidate SHA.

The repository exposes root `pnpm format`, root `test:watch`, and `test:watch` in the 21 workspaces that currently use Vitest. Husky invokes lint-staged at pre-commit so staged TypeScript/JavaScript receives the approved Prettier/ESLint fixes and staged YAML receives Prettier. The hook does not run TypeScript, tests, builds, `pnpm verify`, or Playwright.

Root `AGENTS.md` is the normative workflow authority. It owns code-location guidance, architecture boundaries, Level 0–4 conflict resolution, targeted browser evidence, Full Browser escalation, the explicit static Level 2 verification map, trunk policy, Definition of Done, and the exact-head documentation exception.

GitHub contribution surfaces include the YAML Bug Issue Form and PR template. The PR template delegates affected-consumer selection to `AGENTS.md`, exposes optional targeted browser tag metadata, and records targeted browser evidence separately from the Full Browser escalation decision.

Lean CI remains the normal mandatory PR CI owner and produces the exact Game/Terrain Lab build artifacts. Browser CI consumes those artifacts rather than rebuilding and has two mutually exclusive modes: targeted mode for approved PR-body ownership tags, and full mode for `full-ci`, manual dispatch, or nightly regression. Ordinary PR synchronization does not run the unfiltered Full Browser suite without an explicit full-regression trigger.

`master` is the always-releasable trunk by repository policy. Short-lived `feat/*`, `fix/*`, `docs/*`, and `chore/*` branches merge to `master` by pull request; there is no `develop` integration branch. This policy does not claim that GitHub branch protection is technically enabled.

Behavior/public-contract changes update their living system README in the same implementation PR. Required living docs are complete before exact-head verification; post-run CI identifiers belong in the PR body/comment when no tree mutation is required.

## Static Map Maintenance

The Level 2 table in `AGENTS.md` is conservative verification policy, not the architectural dependency graph. Workspace dependency changes that alter consumers must update that table in the same PR. Current package manifests remain the factual input used to review the map.

## Verification Infrastructure Foundation (PR-T2)

PR-T2 adds a deterministic changed-source impact resolver under `tooling/verification/`
and a `pnpm verify:impact` preview command. It answers "from these changed files, what
verification must run?" with a fail-safe escalation model. It does not migrate, remove,
or reduce any Playwright/browser coverage, and does not change CI gate execution,
workers, retries, or browser configuration. See
[Verification Infrastructure Model](verification-model.md) for the risk classification,
ownership model, escalation rules, and non-goals. The foundation is the basis for
PR-T3 Browser Classification / Migration.

## Current Limitations / Deferred

v0.2 intentionally does not:

- refactor `apps/game/src/game-bootstrap.ts` or introduce an Application Layer;
- replace the static downstream map with automatic affected/dependent graph tooling;
- add automatic changed-file-to-Playwright-tag inference;
- add Nx, Turborepo, or another build-graph framework;
- redesign browser-suite sharding or CI parallelization;
- change Playwright worker/retry/timeout policy as part of this verification-policy change;
- change gameplay/runtime behavior, Save formats, or package ownership boundaries.

## Documentation Authority

1. Normative execution policy: [`AGENTS.md`](../../../AGENTS.md)
2. Current approved design: [Browser Verification Policy v0.2](specs/2026-08-17-browser-verification-policy-v0-2.md)
3. Current TDD implementation plan: [Browser Verification Policy v0.2 Implementation Plan](tdd/2026-08-17-browser-verification-policy-v0-2.md)
4. Historical v0.1 design: [Development Workflow System Improvement v0.1](specs/2026-08-07-development-workflow-system-improvement-v0-1.md)
5. Historical v0.1 TDD plan: [Development Workflow System Improvement v0.1 Implementation Plan](tdd/2026-08-07-development-workflow-system-improvement-v0-1.md)
6. Stable v0.1 verification record: [Development Workflow System Improvement v0.1 Verification](verification/2026-08-07-development-workflow-system-improvement-v0-1.md)
7. Human workflow overview: [`docs/development-workflow.md`](../../development-workflow.md)
8. System registry: [`docs/systems/README.md`](../README.md)

The v0.1 documents remain historical design/execution records. v0.2 changes verification topology and policy; it does not redesign gameplay/runtime contracts.
