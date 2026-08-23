# Development Workflow System

**Status:** Implemented — Browser Verification Policy v0.2 + PR-T4 affected execution<br>
**System:** Development Workflow  
**Primary ownership:** repository root configuration, `.github/`, `AGENTS.md`, and development documentation  
**Persistence:** Git-tracked repository configuration and documentation only

## Purpose

Define the repository-owned development loop for humans and AI agents so changes can be located, implemented, verified, documented, and merged with fast feedback without weakening final safety gates.

## Current State

Development Workflow v0.2 makes verification proportional to the affected surface. Package-targeted Level 0/1 verification remains the default inner loop; Level 2 uses the conservative static consumer map; Level 3 `pnpm verify` remains the repository/tooling finalization gate. The PR-T3.3 authority-aware resolver distinguishes deterministic tests, browser contracts, test topology, shared verification infrastructure, and graph-blind runtime composition before selecting escalation.

Browser-observable changes now require targeted Playwright evidence for every affected browser path before PR readiness. Full Browser is not the default gate for every PR: the unfiltered Chromium suite is reserved for explicit Level 4 escalation such as release or milestone closure, shared browser infrastructure with an unbounded impact surface, an explicit `full-ci` PR label, manual workflow dispatch, and nightly scheduled regression.

Lean now computes one exact-head `affected-verification-plan.json` from the PR base SHA and `GITHUB_SHA`. The plan selects owner tests, conservative Level-2 consumers, typechecks, deployment checks, and browser mode/tags. Browser CI consumes that plan and the exact Lean preview artifact; it runs the selected targeted ownership set or the explicit Full Browser mode. PR-body browser metadata is no longer the authority for normal affected execution.

The repository exposes root `pnpm format`, root `test:watch`, and `test:watch` in the 21 workspaces that currently use Vitest. Husky invokes lint-staged at pre-commit so staged TypeScript/JavaScript receives the approved Prettier/ESLint fixes and staged YAML receives Prettier. The hook does not run TypeScript, tests, builds, `pnpm verify`, or Playwright.

Root `AGENTS.md` is the normative workflow authority. It owns code-location guidance, architecture boundaries, Level 0–4 conflict resolution, targeted browser evidence, Full Browser escalation, the explicit static Level 2 verification map, trunk policy, Definition of Done, and the exact-head documentation exception.

GitHub contribution surfaces include the YAML Bug Issue Form and PR template. The PR template delegates affected-consumer selection to `AGENTS.md`, exposes optional targeted browser tag metadata, and records targeted browser evidence separately from the Full Browser escalation decision.

Lean CI remains the normal mandatory PR CI owner and produces the exact Game/Terrain Lab build artifacts plus the affected execution plan. Browser CI consumes those artifacts rather than rebuilding and has two mutually exclusive modes: targeted mode selected by the plan, and full mode for a plan-level shared-infrastructure escalation, `full-ci`, manual dispatch, or nightly regression. Ordinary PR synchronization does not run the unfiltered Full Browser suite without an explicit full-regression trigger.

`master` is the always-releasable trunk by repository policy. Short-lived `feat/*`, `fix/*`, `docs/*`, and `chore/*` branches merge to `master` by pull request; there is no `develop` integration branch. This policy does not claim that GitHub branch protection is technically enabled.

Behavior/public-contract changes update their living system README in the same implementation PR. Required living docs are complete before exact-head verification; post-run CI identifiers belong in the PR body/comment when no tree mutation is required.

## Local-First Candidate Policy (PR-T5+)

System migration PRs use a local-first candidate loop:

```text
local RED
→ local GREEN
→ owner and affected-consumer verification
→ pnpm check
→ targeted browser verification when browser authority is affected
→ clean worktree
→ commit the GREEN candidate
→ push only the GREEN candidate
→ GitHub Actions exact-head independent verification
```

GitHub Actions is not used as the first debugging loop. It is the independent
exact-head verifier after the candidate has passed local gates. The only
exception is behavior that exists specifically on GitHub Actions or hosted
runners, such as workflow events, permissions, artifact handoff, or
hosted-runner semantics that cannot be reproduced locally. Final CI run IDs and
artifact IDs are recorded in the PR body or comment; they do not require a
metadata-only commit.

## Static Map Maintenance

The Level 2 table in `AGENTS.md` is conservative verification policy, not the architectural dependency graph. Workspace dependency changes that alter consumers must update that table in the same PR. Current package manifests remain the factual input used to review the map.

## Verification Infrastructure Foundation (PR-T2 / PR-T3.3)

PR-T2 adds a deterministic changed-source impact resolver under `tooling/verification/`
and a `pnpm verify:impact` preview command. It answers "from these changed files, what
verification must run?" with a fail-safe escalation model. PR-T3.3 makes the resolver
authority-aware: tagged browser specs select targeted ownership evidence, test-topology
metadata selects exact deployment checks, and shared resolver/config/CI changes remain
`GLOBAL`. PR-T4 adds `pnpm verify:affected -- --base <sha> --head <sha> [--json]`,
a safe `execFile` command runner, and CI artifact handoff for the exact
owner/consumer/browser plan. See [Verification Infrastructure Model](verification-model.md)
for the authority classes, risk model, ownership map, escalation rules, and execution contract.

## Current Limitations / Deferred

v0.2 intentionally does not:

- refactor `apps/game/src/game-bootstrap.ts` or introduce an Application Layer;
- replace the static downstream map with automatic affected/dependent graph tooling;
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
