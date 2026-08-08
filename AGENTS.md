# Repository Agent Guide

## Repository Map

`web-three-city` is a TypeScript/Three.js modular-monolith city builder. Navigate by system ownership before editing.

```text
apps/                       runnable composition, UI, and labs
packages/*-core             deterministic domain/foundation authority
packages/*-three            Three.js presentation adapters
packages/camera-input       camera/input adapter utility
packages/shared-testkit     shared test-only helpers
packages/terrain-generator  terrain generation domain utility
tooling/                    repository verification/deployment tooling
docs/systems/               living system registry/spec/ADR/TDD/verification
browser-tests/              browser acceptance and release evidence
```

## How to Locate Code

Use this path rather than repository-wide search-and-edit when an owning handoff exists:

```text
symptom/request
→ docs/systems/README.md
→ docs/systems/<system>/README.md
→ owning package/app
→ colocated tests
→ implementation
```

## Architecture Rules

- `*-core` packages own deterministic domain/foundation behavior and must not depend on DOM or Three.js presentation.
- `*-three` packages are presentation/adapters. They consume domain snapshots/contracts and do not own gameplay state.
- `apps/game` composes systems. Cross-system orchestration never justifies circular core-package imports.
- State authority, Save compatibility, deterministic ordering, and atomic commit behavior must not be weakened by workflow changes.
- Workspace package dependencies must reflect actual imports and remain acyclic.

## Fast Verification

Default to the smallest sufficient loop:

```bash
pnpm --filter @web-three-city/<pkg> test:watch
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
pnpm format
pnpm test:deployment
pnpm verify
pnpm verify:full
pnpm test:browser
```

`pnpm verify` is Level 3 and is not the default after each local edit. Use package-scoped tests and typecheck first.

For repository architecture, test-discovery/topology, CI-topology, deployment-tooling, or shared verification-script changes, use the tooling loop before the Level 3 final gate:

```text
relevant focused tooling test, when available
→ pnpm test:deployment
→ pnpm verify when Level 3 is required
```

`pnpm test:deployment` is fast affected feedback, not a replacement for `pnpm verify` when a Level 3 trigger applies.

### Targeted Browser Feedback

Browser-observable changes may use ownership tags during development:

```bash
pnpm exec playwright test --grep @road
pnpm exec playwright test --grep @rci
pnpm exec playwright test --grep @building
pnpm exec playwright test --grep @smoke
```

Supported ownership tags are `@smoke`, `@terrain`, `@water`, `@road`, `@zoning`, `@building`, `@rci`, `@interaction`, `@visual`, `@performance`, and `@release`. Select the tag or union of tags that covers the changed behavior. If several domains or shared interaction paths are affected, run every relevant subset or escalate under the existing verification rules.

Tagged subsets are affected fast feedback; they are not a new verification level and never replace the full browser release authority. Do not run the full browser suite after every small edit when a focused subset answers the development question.

### Browser Release Authority

- The release authority is the one unfiltered Chromium project. Repository topology tests enforce its current inventory and require approved ownership tags without excluding tests from the full project.
- Level 4 uses the canonical `pnpm verify:full` command and therefore runs the full browser authority.
- Targeted `--grep` subsets cannot qualify as full release, browser-acceptance, or milestone-closure evidence.
- Playwright currently enforces `workers: 2` and `retries: 0`. Do not add retries to conceal flaky behavior or broaden workers/timeouts repository-wide as a workaround. Change worker count or timeout strategy only from measured evidence, using narrow per-spec budgets when a specific test requires one.

### CI Verification Ownership

```text
Lean CI
  ├─ repository verification, unit tests, typecheck, and build
  └─ publish exact browser preview build artifact
          ↓
Browser CI
  ├─ consume the exact Lean artifact
  ├─ install browser runtime
  └─ run browser acceptance/release evidence
```

- Lean CI owns repository verification and application builds.
- Browser CI reuses the exact Lean-produced Game and Terrain Lab outputs. Apart from dependency/browser setup, clean-worktree validation, and evidence retention, its responsibility is browser verification only.
- Browser CI must not duplicate `pnpm check`, unit suites, typecheck, or application builds.
- A CI-topology change must update the architecture/CI topology contract tests in the same PR. Do not add duplicate verification “for safety” without an explicit architecture decision backed by evidence.

## Verification Escalation Rules

The final gate is determined by these normative rules. Lower levels remain the preferred feedback loop during implementation.

```text
request/change → owning system → Level 0 focused iteration → Level 1 owner
→ Level 2 affected consumers → targeted browser tags when browser-observable
→ Level 3 when triggered → Level 4 when triggered → exact-head evidence → PR/merge
```

- **Level 0 — Focused iteration.** Run a focused Vitest file/test name or package `test:watch` while actively editing. Do not run repository-wide verification.
- **Level 1 — Owning package.** Default localized-code gate: owning package `test` plus `typecheck`.
- **Level 2 — Affected consumers.** A public/exported contract, exported type, runtime assumption, Save-facing contract, or behavior observable by another package requires at least Level 2. Run the owner and the consumers listed in the static map below.
- **Level 3 — PR finalization / repository tooling.** Root/workspace/tooling configuration changes, including TypeScript, ESLint, Prettier, Vitest, pnpm workspace, CI workflow, shared verification tooling, or development-dependency configuration, require Level 3. Canonical gate: `pnpm verify`.
- **Level 4 — Browser/release/milestone closure.** Browser-visible behavior requiring browser acceptance, release closure, milestone closure, or another explicit repository trigger requires Level 4. Canonical gate: `pnpm verify:full`.

Conflict resolution:

1. The **highest required level wins** as the final gate; lower levels are still used first for fast feedback.
2. Public/exported contract change implies at least Level 2; never stop at the owner when a consumer can observe the change.
3. Root/workspace/tooling configuration change implies Level 3.
4. Browser-visible behavior requiring browser acceptance, release closure, or milestone closure implies Level 4 at finalization.
5. Save schema/compatibility behavior requires the owner plus `game` at Level 2 minimum, followed by the relevant final gate required by the milestone.
6. A workspace dependency relationship addition/removal that changes consumers must update the Static Level 2 Verification Map in the **same PR**.
7. Uncertain ownership or impact means escalate one level and inspect the registry/manifests. Do not jump directly to Level 4 merely because of uncertainty.
8. PR templates cannot redefine escalation; this section is the repository authority.

## Static Level 2 Verification Map

This is a **conservative verification map**, not the architectural dependency graph. Extra verification is acceptable; omitting a real consumer is not.

| Changed owner | Level 2 verification consumers |
| --- | --- |
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

Maintenance rules:

- Treat the table as conservative verification policy, not generated architecture authority.
- Inspect relevant workspace `package.json` manifests whenever dependency relationships change.
- Update this map in the same PR as any dependency relationship change that alters consumers.
- A new package must have ownership and Level 2 consumers assigned before its implementation PR is ready.
- If a listed consumer has no `test` script, run its available `typecheck`/build gate as appropriate rather than fabricating a no-op test.
- v0.2 may replace this table with affected/dependent graph tooling; until then this map is authoritative for Level 2 selection.

## Branch Policy

`master` is the always-releasable trunk **by repository policy**. Short-lived `feat/*`, `fix/*`, `docs/*`, and `chore/*` branches merge through pull requests into `master`. A release boundary is an accepted `master` commit and/or Git tag. There is no `develop` integration branch.

This describes repository policy; do not infer that GitHub branch-protection settings are technically enabled without checking repository settings.

## Documentation and Exact-Head Evidence

Behavior, public contracts, ownership, dependency direction, Save semantics, and extension-boundary changes must update `docs/systems/<system>/README.md` in the same PR. Required living documentation must already be correct **before exact-head verification** begins.

Exact-head CI evidence exists only after the candidate exists. Do not create a new commit merely to insert a CI run ID or CI metadata after exact-head verification. Record run IDs, artifact IDs, final counts, and equivalent evidence in the PR body or PR comment when the repository tree does not need to change. A stable verification record may be prepared before the run with acceptance criteria that do not require post-run mutation.

A bounded post-merge documentation-only closure commit is allowed only when an older milestone contract genuinely requires it; it must not become the normal workflow.

## Definition of Done

- Scope/system ownership is correct and no unrelated behavior is included.
- Targeted Level 0/1 verification is used during implementation and the required final level passes.
- Required Level 2 consumers are selected from this file, not from memory.
- Browser-observable affected feedback uses the relevant ownership tags, while any triggered Level 4 gate uses the full unfiltered browser authority.
- Repository tooling changes use focused contracts and `pnpm test:deployment` before the required Level 3 final gate.
- Relevant living documentation is updated in the same PR.
- Determinism and Save compatibility are preserved or explicitly addressed where applicable.
- No temporary/debug artifacts remain.
- Required final-gate evidence is recorded, including exact candidate SHA when exact-head verification applies.

## Forbidden Shortcuts

- Do not use whole-repository `pnpm verify` or `pnpm verify:full` after every small edit instead of targeted feedback.
- Do not present targeted browser subsets as full release evidence or weaken failures with broad retries, worker increases, or global timeout expansion.
- Do not make Browser CI repeat Lean-owned checks, tests, typechecks, or builds without an approved, evidence-backed architecture change.
- Do not skip Level 2 for observable public-contract changes.
- Do not invent downstream consumers from memory when this map and workspace manifests exist.
- Do not merge with knowingly stale required living documentation.
- Do not make formatter-only cleanup PRs the normal path; use `pnpm format` and the staged hook before committing.
- Do not put runtime/domain behavior into `*-three` presentation code or into workflow documentation/configuration.
