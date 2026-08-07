# Development Workflow System Improvement v0.1 — Design Specification

**Status:** Approved  
**System:** `development-workflow`  
**Date:** `2026-08-07`

## Decision Summary

Upgrade the repository development workflow before adding the next gameplay milestone. The v0.1 change keeps the existing modular game architecture and final verification safety gates, but replaces slow repository-wide inner-loop verification and repeated cleanup commits with targeted package verification, automatic staged-file formatting/linting, explicit AI instructions, structured GitHub templates, and a same-PR documentation Definition of Done.

The normal AI loop must no longer default to `pnpm verify`. During implementation, the owning package is verified first with `pnpm --filter @web-three-city/<pkg> test` and `pnpm --filter @web-three-city/<pkg> typecheck`. Verification escalates only according to an explicit Level 0–4 policy. Until automated affected-graph tooling exists, Level 2 downstream consumers are defined by a conservative static map in root `AGENTS.md`; that map is repository authority and must be maintained in the same PR whenever workspace dependency relationships change.

`master` remains the always-releasable trunk. The obsolete `develop` workflow is not restored. Product work uses short-lived `feat/*`, `fix/*`, `docs/*`, or equivalent scoped branches that merge by PR into `master`.

## Context

The repository has reached the point where workflow overhead is slowing implementation more than domain code itself. Recent work exposed four recurring root causes:

1. **Prettier correction loops** — formatting failures caused repeated `style(...)` or formatter-only commits because the root currently exposes `format:check` but no canonical auto-fix command and no pre-commit formatter.
2. **Documentation finalization churn** — behavior, verification status, and living docs were repeatedly normalized after implementation instead of being treated as one Definition of Done.
3. **AI repository rediscovery** — there is no root `AGENTS.md`, so each agent/session must reconstruct package roles, verification commands, branch policy, and documentation ownership from scattered files and history.
4. **Over-broad verification** — root `pnpm verify` aliases the whole-workspace check and is too expensive to be the default after every localized edit.

Verified repository baseline before this design:

- Node baseline is `22`; root engine is `>=22.0.0`.
- Package manager is `pnpm@10.13.1`.
- Root `test` recursively invokes tests across workspaces.
- Root `verify` aliases the complete `check` pipeline.
- Vitest is used by testable workspace packages such as `rci-core` and `game`.
- There is no `AGENTS.md` in the repository.
- The active branch model contains `master` and short-lived branches; there is no `develop` branch.
- `docs/development-workflow.md` still describes `develop` as the integration branch and therefore contradicts repository reality.
- `docs/systems/README.md` still describes RCI as “Approved design — not implemented”, while `packages/rci-core`, its tests, its living README, and merged verification evidence show RCI is implemented and verified.

## Goals

1. Make the default AI edit/verify loop package-targeted and fast.
2. Preserve repository-wide and browser verification as slower escalation gates rather than inner-loop defaults.
3. Eliminate routine formatter-only correction commits by auto-fixing staged files before commit.
4. Give AI agents one authoritative onboarding file containing architecture navigation, commands, verification escalation, branch policy, and Definition of Done.
5. Make Level 2 verification deterministic and actionable before affected-graph tooling exists by maintaining a static downstream map.
6. Make PR verification checklists derive their “affected consumer” requirement directly from `AGENTS.md`, not agent judgment.
7. Require behavior-changing PRs to update living system documentation in the same PR, while explicitly handling final exact-head CI evidence that cannot be known before the candidate commit exists.
8. Replace the obsolete `develop` workflow with a lightweight trunk-based model centered on `master`.
9. Add structured GitHub bug intake so a report immediately identifies the likely owning system and repository entry point.
10. Repair known registry/workflow documentation drift as part of the same milestone.

## Non-Goals

The following are intentionally outside v0.1:

- refactoring `apps/game/src/game-bootstrap.ts`;
- introducing a new Application Layer or runtime orchestration architecture;
- changing gameplay behavior or Save formats;
- adding Nx, Turborepo, or another build graph framework;
- implementing automatic affected/dependent graph computation;
- browser-suite tagging, sharding, or CI parallelization redesign;
- changing package ownership or dependency direction;
- adding Economy or any other gameplay milestone;
- adding typecheck or unit tests to the pre-commit hook;
- replacing final repository-wide verification gates.

These are separate follow-up milestones after the workflow foundation is stable.

## System Boundary

Development Workflow v0.1 owns repository-development mechanics only:

```text
Developer / AI edit
        │
        ▼
Targeted package loop
        │
        ├─ test / watch
        ├─ package typecheck
        └─ affected consumer escalation
        │
        ▼
pre-commit
        │
        ├─ Prettier --write staged files
        └─ ESLint --fix staged code files
        │
        ▼
Pull Request
        │
        ├─ DoD + docs
        ├─ exact verification commands/results
        └─ CI escalation
        │
        ▼
master (always releasable)
```

Domain packages, Three.js adapters, game runtime behavior, and browser acceptance semantics remain owned by their existing systems.

## Authoritative and Derived State

There is no gameplay state in this milestone.

Repository authorities after implementation are:

- `AGENTS.md` — AI development/verification/navigation policy.
- workspace `package.json` files — package scripts and workspace dependency declarations.
- root `package.json` — shared scripts and development dependencies.
- `.husky/pre-commit` plus lint-staged configuration — local staged-file guard.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — structured bug intake.
- `.github/pull_request_template.md` — PR Definition of Done entry point.
- `docs/systems/<system>/README.md` — current behavior/status authority for each game system.
- `docs/systems/README.md` — registry/index, not a replacement for owning system READMEs.
- `docs/systems/development-workflow/README.md` — current-state handoff for this workflow system after implementation.

PR comments, CI run metadata, and final merge metadata are derived verification evidence. They must not override code or living-system documentation contracts.

## Main Workflow

### 1. Locate the owning code before editing

Root `AGENTS.md` must teach the canonical navigation path:

```text
symptom / requested behavior
→ docs/systems/README.md registry
→ docs/systems/<system>/README.md
→ owning package(s)
→ colocated *.test.ts tests
→ implementation
```

Agents must not begin with repository-wide search-and-edit when an owning-system handoff exists.

### 2. Use the smallest sufficient verification loop

The default development loop is Level 0 or Level 1. `pnpm verify` is not the default after a local edit.

Canonical package commands:

```bash
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
```

Examples:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck

pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

The phrase **test:pkg** in workflow documentation refers to this canonical `pnpm --filter ... test` pattern; v0.1 does not add a brittle dynamic wrapper script solely to abbreviate it.

### 3. Auto-fix style before a commit is created

The root adds a canonical formatting command:

```json
"format": "prettier --write \"**/*.{ts,js,yml,yaml}\""
```

The existing `format:check`, `lint`, `typecheck`, `verify`, and `verify:full` commands remain final/slow gates.

Husky and lint-staged run only on staged files:

```text
staged code files
→ prettier --write
→ eslint --fix

staged supported config/data files
→ prettier --write
```

The hook must not execute root `pnpm lint`, repository typecheck, package tests, `pnpm verify`, or browser tests.

### 4. Complete behavior and living docs in the same implementation PR

A behavior or public-contract change must update `docs/systems/<system>/README.md` in the same implementation PR before that PR is considered ready.

The same rule applies to ownership, dependency direction, Save semantics, and documented extension boundaries.

### 5. Preserve exact-head verification without creating documentation churn

Final CI evidence is a special case because run IDs, final test counts, artifact IDs, and exact-head results can only exist after the candidate head is created.

`AGENTS.md` must state this exception explicitly from the start of work:

- required living behavior documentation must already be correct in the implementation PR before final exact-head verification;
- do not create a new code/docs commit merely to insert final CI run metadata if doing so would invalidate the exact verified head;
- record post-run evidence in PR body/comments and merge metadata when tree changes are unnecessary;
- a repository verification record may be prepared in the same PR with stable acceptance criteria and links that do not require post-verification mutation;
- if a post-merge documentation-only closure commit is genuinely required by an existing milestone contract, it must be one bounded exception, contain no runtime/test change, and must not become the normal workflow.

This exception belongs in `AGENTS.md` as a normative rule, not only in the PR template.

## Verification Ladder

### Level 0 — Focused iteration

Use while actively editing one behavior.

Preferred actions:

- run a focused Vitest test file/test name where practical;
- use package `test:watch` for rapid iteration;
- do not run repository-wide verification.

Target: seconds.

### Level 1 — Owning package gate

Default AI verification after a localized code change:

```bash
pnpm --filter @web-three-city/<owning-package> test
pnpm --filter @web-three-city/<owning-package> typecheck
```

For a testable app such as `@web-three-city/game`, use the same package-scoped commands.

### Level 2 — Affected consumer gate

Required when a change can alter a public contract, exported type, runtime assumption, Save-facing contract, or behavior consumed outside the owning package.

Run Level 1 for the owner, then package-scoped `test` and `typecheck` for consumers listed by the static verification downstream map in `AGENTS.md`.

Level 2 is not based on AI memory or informal knowledge. The static map is authoritative until affected-graph tooling supersedes it.

### Level 3 — PR finalization / Lean repository gate

Required for code/configuration PR finalization according to repository CI policy.

This is where repository-wide formatting/lint/type/build/test verification may run. It is intentionally slower than Level 0–2 and must not replace them as the normal edit loop.

Canonical repository command remains:

```bash
pnpm verify
```

CI may run the same or equivalent repository-owned Lean gate.

### Level 4 — Release / milestone closure

Required when the change affects browser-observable gameplay that needs full acceptance, for milestone closure, or whenever repository policy explicitly requires complete browser verification.

Canonical command remains:

```bash
pnpm verify:full
```

Level 4 retains exact-head evidence and clean-worktree requirements.

## Verification Escalation Conflict Resolution

These rules remove ambiguity when more than one condition applies:

1. **Highest required level wins.** If one aspect requires Level 1 and another requires Level 3, use Level 3 as the final gate while still using lower levels for feedback during implementation.
2. **Public/exported contract change ⇒ at least Level 2.** Do not stop at the owner if a consumer can observe the change.
3. **Workspace/tooling/root configuration change ⇒ Level 3.** Changes to root TypeScript, ESLint, Prettier, Vitest, pnpm workspace, CI workflow, shared verification tooling, or development dependency configuration are repository-wide by definition.
4. **Browser-visible behavior requiring browser acceptance ⇒ Level 4 when closing the PR/milestone.** Package tests remain the inner loop first.
5. **Save schema/compatibility behavior ⇒ owner + game consumer at Level 2 minimum, then the relevant final gate required by the milestone.**
6. **Dependency-map change ⇒ update `AGENTS.md` static downstream map in the same PR.** A `package.json` workspace dependency addition/removal that changes consumers cannot merge with a knowingly stale map.
7. **Uncertain ownership or impact ⇒ escalate one level, then inspect registry/package manifests.** Do not immediately jump from uncertainty to full browser verification.
8. **PR template cannot redefine escalation.** It must link back to `AGENTS.md § Verification Escalation Rules`; `AGENTS.md` is the authority.

## Static Verification Downstream Map

Until automated affected-graph tooling exists, root `AGENTS.md` must contain and maintain a conservative table derived from current workspace package relationships.

The table is a **verification map**, so it may intentionally include important app/adaptor consumers beyond direct package dependencies. A false-positive consumer is acceptable; a missing consumer that allows a broken contract to escape Level 2 is not.

Initial v0.1 map:

| Changed owner | Level 2 verification consumers |
|---|---|
| `world-core` | `terrain-core`, `road-core`, `water-core`, `zone-core`, `building-core`, `rci-core`, `building-three`, `road-three`, `terrain-three`, `water-three`, `zone-three`, `game`, `terrain-lab` |
| `terrain-core` | `road-core`, `water-core`, `zone-core`, `building-core`, `road-three`, `terrain-three`, `game`, `terrain-lab` |
| `simulation-core` | `building-core`, `rci-core`, `game` |
| `zone-core` | `building-core`, `rci-core`, `zone-three`, `game` |
| `building-core` | `rci-core`, `building-three`, `game` |
| `rci-core` | `game` |
| `road-core` | `road-three`, `game`, `terrain-lab` |
| `water-core` | `water-three`, `game`, `terrain-lab` |
| `terrain-generator` | `game`, `terrain-lab` |
| `camera-input` | `game`, `terrain-lab` |
| `building-three` | `game` |
| `road-three` | `game`, `terrain-lab` |
| `terrain-three` | `game`, `terrain-lab` |
| `water-three` | `game`, `terrain-lab` |
| `zone-three` | `game` |

Rules for maintenance:

- treat the table as conservative verification policy, not as a generated architectural graph;
- check relevant workspace `package.json` manifests whenever a package dependency changes;
- update the table in the same PR as a dependency relationship change;
- if a new package is added, assign its owner and Level 2 consumers before the implementation PR is ready;
- if a listed package has no `test` script, run its available `typecheck`/build gate as appropriate rather than fabricating a no-op test solely to satisfy the table;
- v0.2 may replace this static map with automatic affected/dependent graph tooling, at which point `AGENTS.md` must clearly mark the supersession.

## Fast Loop Scripts

### Root scripts

Add:

```json
{
  "format": "prettier --write \"**/*.{ts,js,yml,yaml}\"",
  "test:watch": "pnpm -r --if-present test:watch"
}
```

Keep unchanged in meaning:

- `format:check`
- `lint`
- `typecheck`
- `test`
- `check`
- `verify`
- `verify:full`
- browser test commands

### Testable workspace scripts

Every workspace package/app already using Vitest should expose:

```json
"test:watch": "vitest"
```

Do not add meaningless `test:watch` scripts to workspaces that do not have a Vitest test surface.

## Pre-Commit Guard

Add root development dependencies:

- `husky`
- `lint-staged`

Add root setup:

```json
"prepare": "husky"
```

Add:

```text
.husky/pre-commit
```

that runs:

```sh
pnpm exec lint-staged
```

lint-staged requirements:

- Prettier auto-fix only files that are staged and supported by repository formatting policy.
- ESLint `--fix` only staged code files.
- Do not invoke root `eslint .` from the hook.
- Do not invoke TypeScript, Vitest, build, `pnpm verify`, or Playwright from the hook.
- Respect `.prettierignore`, including the existing `pnpm-lock.yaml` exclusion.
- A developer may bypass a local hook when necessary; CI/final verification remains authoritative. The hook is fast feedback, not the release security boundary.

Expected normal overhead: a few seconds, proportional to staged files rather than repository size.

## Root AGENTS.md Contract

v0.1 creates exactly one root `AGENTS.md`. No hierarchy is added yet.

It must contain these sections:

1. **Repository purpose and architecture map**
   - `apps/` = composition/application surfaces;
   - `packages/*-core` = deterministic domain/foundation logic;
   - `packages/*-three` = Three.js presentation adapters;
   - `tooling/` = repository verification/deployment tooling;
   - `docs/systems/` = current system handoff, specs, ADRs, TDD, verification.

2. **How to locate code**
   - symptom → system registry → system README → owning package → colocated tests.

3. **Core architecture rules**
   - core code remains deterministic;
   - core must not depend on DOM/Three.js/app presentation;
   - `*-three` is presentation/adaptation;
   - existing package authority and Save invariants remain intact.

4. **Fast-loop commands**
   - `pnpm format`;
   - package-targeted test pattern (`test:pkg` concept): `pnpm --filter @web-three-city/<pkg> test`;
   - package-targeted typecheck;
   - `test:watch`;
   - `pnpm verify` only as Level 3;
   - `pnpm verify:full` as Level 4;
   - browser commands where relevant.

5. **Verification Ladder and Escalation Rules**
   - Level 0–4 definitions;
   - conflict resolution;
   - static downstream map;
   - rule that the map changes with dependency relationships.

6. **Branch policy**
   - `master` is the always-releasable trunk;
   - work uses short-lived branches and PRs;
   - no `develop` branch;
   - release identity is represented by tags/releases rather than a permanent integration branch.

7. **Definition of Done**
   - targeted tests/typecheck appropriate to the ladder passed;
   - affected consumer verification required by the static map passed;
   - required final CI gate passed on the candidate head;
   - living system docs updated in the same PR when behavior/contracts changed;
   - no unrelated/debug artifacts;
   - Save compatibility/determinism considered where relevant.

8. **Exact-head documentation exception**
   - the full rule from this specification must be present before implementation begins, not discovered only at PR finalization.

9. **Forbidden workflow shortcuts**
   - do not default to whole-repo verification for every edit;
   - do not knowingly merge stale living docs;
   - do not add post-verification commits merely to record CI metadata;
   - do not restore `develop` without a new approved architecture decision;
   - do not expand v0.1 into gameplay/application-layer refactors.

## GitHub Bug Issue Form

Create:

```text
.github/ISSUE_TEMPLATE/bug_report.yml
```

Use GitHub Issue Form schema rather than a Markdown issue template so required fields and dropdowns are enforceable.

Required fields:

- **System** — dropdown based on the system registry, including `Cross-system / Unknown`.
- **Symptom** — required textarea.
- **Expected behavior** — required textarea.
- **Actual behavior** — required textarea.
- **Reproduction steps** — required textarea.

Optional but encouraged:

- game time/save context;
- browser/device/environment;
- screenshots/video;
- console output;
- last known working version/commit.

Initial system options must represent the current registry vocabulary:

- World
- Terrain
- Water
- Roads
- Zoning
- Buildings
- Simulation Time
- RCI Demand & Occupancy
- Economy
- Documentation / Development Workflow
- Cross-system / Unknown

The form must tell the reporter/agent that the selected system maps to `docs/systems/<system>/README.md` for ownership discovery.

## GitHub Pull Request Template

Create:

```text
.github/pull_request_template.md
```

Required structure:

```text
Scope
- system
- owning package(s)
- behavior/contract changed

Verification
- targeted owning package tests
- targeted owning package typecheck
- affected consumer verification
- relevant browser verification when required
- CI/final gate evidence

Documentation
- living system README updated
  OR
- explicit statement that behavior/contracts are unchanged

Definition of Done
- no unrelated/debug changes
- Save/determinism considered where relevant
- exact candidate SHA/evidence recorded
```

The affected-consumer checklist item must explicitly say:

> Required consumers are defined by `AGENTS.md § Verification Escalation Rules` and the static downstream map; do not decide “where required” independently in this template.

The PR template is a checklist surface. It must not become a second copy of the downstream table or redefine escalation semantics.

## Documentation and Registry Sync

The implementation PR must repair known drift while establishing the new workflow.

### `docs/systems/README.md`

RCI registry status must be updated from stale planning data to current truth:

```text
RCI Demand & Occupancy
Status: Implemented
Primary ownership: rci-core + apps/game orchestration
Persistence: RciSaveV1 / WorldSaveV5
```

The Development Workflow system must be added to the registry with its post-implementation status and ownership.

### `docs/development-workflow.md`

Remove the obsolete permanent `develop` branch model and document:

```text
short-lived branch
       ↓ PR
master (always releasable trunk)
       ↓ release/tag/deployment as configured
```

The document must align with `AGENTS.md` verification levels rather than teaching `pnpm verify` as the standard command after every implementation change.

### Same-PR rule

After v0.1, any PR that changes system behavior, public contracts, ownership, Save semantics, dependencies, or extension boundaries must update the owning living README in that PR or explicitly assert that system behavior/contracts are unchanged.

## Branch Policy

Approved v0.1 policy:

```text
master
  = integration baseline
  = always releasable trunk
  = PR target

feat/* | fix/* | docs/* | other scoped short-lived branch
  = implementation/planning work
  = merge by PR into master

release identity
  = tag / GitHub release / deployment metadata
```

A permanent `develop` branch is not part of v0.1.

This decision is optimized for a solo developer with AI-driven implementation and no current need for concurrent feature batching or a separate release train.

## Failure Behavior

- A Husky failure blocks the local commit until staged formatting/lint issues are fixed or the developer explicitly bypasses the local hook.
- Hook success does not imply tests/typecheck passed.
- Level 1 success does not imply consumers passed when Level 2 is required.
- Missing or stale downstream mapping for a changed dependency is a workflow defect and blocks DoD.
- PR template completion without the required AGENTS-defined gate is insufficient.
- CI/final gate failure blocks merge according to repository policy.
- The workflow must never modify game/save state.

## Determinism and Performance

This milestone does not alter game simulation determinism.

Development-loop performance principles:

- staged-file hooks scale with changed files, not the repository;
- package tests/typecheck precede repository verification;
- no whole-repository command is required between every small edit;
- no browser suite is required merely because a core implementation file changed unless escalation rules require browser acceptance for the final gate.

Initial workflow targets are directional rather than hard CI budgets:

- pre-commit: a few seconds for normal commits;
- Level 0: seconds;
- Level 1: package-scale feedback, preferably under ~30 seconds for typical packages;
- Level 3/4 remain slower safety gates and will be optimized further in a separate CI/test architecture milestone.

## Extension Points

v0.1 deliberately creates simple seams for future workflow automation:

- static downstream map can later be generated from workspace manifests;
- verification ladder can later drive an affected-test command;
- browser tests can later be tagged/sharded by system;
- root `AGENTS.md` can later gain scoped child files only when repository size makes one file insufficient;
- PR/Issue templates can later consume generated registry data if maintaining duplicated dropdown vocabulary becomes material overhead.

No generic workflow framework is introduced now.

## Acceptance Criteria

### Fast loop

- [ ] Root `pnpm format` auto-fixes the same source/config classes covered by the approved formatter policy.
- [ ] Vitest workspaces expose `test:watch` where they have a real test surface.
- [ ] Documentation teaches package-targeted `pnpm --filter @web-three-city/<pkg> test` and package typecheck as the default AI verification.
- [ ] `pnpm verify` is documented as Level 3, not default inner-loop behavior.

### Pre-commit

- [ ] Husky and lint-staged install cleanly on Node 22 / pnpm 10.
- [ ] Pre-commit runs Prettier and ESLint fix only against staged applicable files.
- [ ] Pre-commit does not run typecheck, tests, build, `pnpm verify`, or Playwright.
- [ ] A deliberately misformatted staged supported file is corrected before commit.
- [ ] A staged ESLint-fixable code issue is fixed or blocks appropriately.

### AGENTS.md

- [ ] Root `AGENTS.md` exists and contains architecture navigation, package rules, commands, Level 0–4 ladder, conflict resolution, static downstream map, trunk policy, DoD, and exact-head documentation exception.
- [ ] Static downstream map is actionable without outside/tribal knowledge.
- [ ] Map maintenance is explicitly coupled to workspace dependency changes.

### GitHub contribution surfaces

- [ ] Bug intake is a YAML Issue Form with required system/symptom/expected/actual/reproduction fields.
- [ ] PR template links affected-consumer verification directly to `AGENTS.md § Verification Escalation Rules`.
- [ ] PR template does not duplicate the downstream table.
- [ ] PR template requires same-PR living documentation or an explicit unchanged-behavior assertion.

### Documentation

- [ ] `docs/development-workflow.md` no longer describes a nonexistent `develop` integration branch.
- [ ] `docs/systems/README.md` reports RCI as implemented with real ownership/persistence.
- [ ] Development Workflow system is registered and its living README reflects implemented state after merge.
- [ ] No contradictory branch or default-verification policy remains in active workflow documentation.

### Safety

- [ ] Existing `format:check`, `lint`, `typecheck`, `verify`, and `verify:full` meanings remain available as final gates.
- [ ] No gameplay/runtime/Save behavior changes are included.
- [ ] No `game-bootstrap.ts` refactor is included.
- [ ] No Nx/Turbo/affected-graph framework is introduced.

## Delivery / PR Decomposition

### Planning PR

This approved specification and Development Workflow system handoff only. No workflow behavior changes.

### Implementation PR

Deliver v0.1 as one bounded PR so the workflow change does not reproduce the documentation-finalization spam it is intended to remove.

The implementation PR contains:

1. root scripts and development dependencies;
2. `test:watch` additions to real Vitest workspaces;
3. Husky + lint-staged configuration;
4. root `AGENTS.md` including static downstream map and exact-head exception;
5. GitHub Issue Form;
6. GitHub PR template linked to AGENTS escalation authority;
7. workflow documentation rewrite;
8. RCI registry repair and Development Workflow registry entry;
9. system README transition from approved design to implemented;
10. verification of local hook behavior, targeted package commands, and existing final gates.

Do not split documentation finalization into a chain of follow-up implementation PRs unless an exact-head evidence exception genuinely requires one bounded docs-only closure.

## Future Milestones

Separate follow-up design work may cover:

1. architecture boundary enforcement and dependency-cycle checks;
2. automatic affected/dependent graph verification;
3. `game-bootstrap.ts` decomposition and an explicit application/composition layer;
4. browser test tagging/sharding and CI wall-clock reduction;
5. optional Turborepo/Nx evaluation only if pnpm-native workflow is insufficient.

## Related Documents

- System overview: [`../README.md`](../README.md)
- Current legacy workflow to be replaced/updated during implementation: [`../../../development-workflow.md`](../../../development-workflow.md)
- System registry to be synchronized during implementation: [`../../README.md`](../../README.md)
- RCI current-state authority: [`../../rci/README.md`](../../rci/README.md)
- ADRs: none required for v0.1; trunk policy is reversible and captured by this specification.
- TDD/implementation plan: to be created after planning approval is merged.
- Verification: to be created/executed with the implementation PR.
