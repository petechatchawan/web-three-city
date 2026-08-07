# Development Workflow System

**Status:** Implemented  
**System:** Development Workflow  
**Primary ownership:** repository root configuration, `.github/`, `AGENTS.md`, and development documentation  
**Persistence:** Git-tracked repository configuration and documentation only

## Purpose

Define the repository-owned development loop for humans and AI agents so changes can be located, implemented, verified, documented, and merged with fast feedback without weakening final safety gates.

## Current State

Development Workflow v0.1 is implemented on the implementation branch. Package-targeted Level 0/1 verification is the default inner loop; Level 2 uses the conservative static consumer map; Level 3 `pnpm verify` is the repository/tooling finalization gate; and Level 4 `pnpm verify:full` is reserved for browser/release/milestone closure according to `AGENTS.md` § Verification Escalation Rules.

The repository exposes root `pnpm format`, root `test:watch`, and `test:watch` in the 17 workspaces that already use Vitest. Husky invokes lint-staged at pre-commit so staged TypeScript/JavaScript receives the approved Prettier/ESLint fixes and staged YAML receives Prettier. The hook does not run TypeScript, tests, builds, `pnpm verify`, or Playwright.

Root `AGENTS.md` is the normative AI workflow authority. It owns code-location guidance, architecture boundaries, Level 0–4 conflict resolution, the explicit static Level 2 verification map, trunk policy, Definition of Done, and the exact-head documentation exception.

GitHub contribution surfaces include the YAML Bug Issue Form and PR template. The PR template delegates affected-consumer selection to `AGENTS.md` rather than redefining escalation rules.

`master` is the always-releasable trunk by repository policy. Short-lived `feat/*`, `fix/*`, `docs/*`, and `chore/*` branches merge to `master` by pull request; there is no `develop` integration branch. This policy does not claim that GitHub branch protection is technically enabled.

Behavior/public-contract changes update their living system README in the same implementation PR. Required living docs are complete before exact-head verification; post-run CI identifiers belong in the PR body/comment when no tree mutation is required.

## Static Map Maintenance

The Level 2 table in `AGENTS.md` is conservative verification policy, not the architectural dependency graph. Workspace dependency changes that alter consumers must update that table in the same PR. Current package manifests remain the factual input used to review the map.

## Current Limitations / Deferred v0.2

v0.1 intentionally does not:

- refactor `apps/game/src/game-bootstrap.ts` or introduce an Application Layer;
- replace the static downstream map with automatic affected/dependent graph tooling;
- add Nx, Turborepo, or another build-graph framework;
- redesign browser-suite tagging, sharding, or CI parallelization;
- change gameplay/runtime behavior, Save formats, or package ownership boundaries.

## Documentation Authority

1. Normative execution policy: [`AGENTS.md`](../../../AGENTS.md)
2. Approved design: [Development Workflow System Improvement v0.1](specs/2026-08-07-development-workflow-system-improvement-v0-1.md)
3. TDD implementation plan: [Development Workflow System Improvement v0.1 Implementation Plan](tdd/2026-08-07-development-workflow-system-improvement-v0-1.md)
4. Stable verification record: [Development Workflow System Improvement v0.1 Verification](verification/2026-08-07-development-workflow-system-improvement-v0-1.md)
5. Human workflow overview: [`docs/development-workflow.md`](../../development-workflow.md)
6. System registry: [`docs/systems/README.md`](../README.md)

The approved specification and TDD plan remain historical design/execution records. Delivery status and final exact-head evidence are recorded by this living handoff, the stable verification record, and PR #35 without rewriting historical decisions after verification.
