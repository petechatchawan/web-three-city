# Development and Release Workflow

## Branch model

`master` is the always-releasable trunk by repository policy. There is no `develop` integration branch.

Implementation, fixes, refactors, tests, and documentation use short-lived `feat/*`, `fix/*`, `docs/*`, or `chore/*` branches. Every short-lived branch targets `master` through a pull request. Do not infer technical branch-protection enforcement from this policy; check repository settings when enforcement matters.

```text
short-lived feat/* | fix/* | docs/* | chore/*
                  ↓ pull request
master — always-releasable trunk
                  ↓ accepted production commit / optional Git tag
Vercel Production — master Git integration
```

## Verification Ladder

`AGENTS.md` § Verification Escalation Rules is the normative authority. Use the lowest sufficient level while implementing and the highest required level as the final gate.

- **Level 0 — Focused iteration.** Run a focused test or package watch command while actively editing.
- **Level 1 — Owning package.** Run the owning package `test` and `typecheck`; this is the default localized feedback loop.
- **Level 2 — Affected consumers.** When a public/runtime/Save-facing contract can affect consumers, verify the packages selected by the static map in `AGENTS.md`.
- **Level 3 — Repository/tooling finalization.** Run `pnpm verify` for root/workspace/tooling configuration changes and other Level 3 triggers.
- **Level 4 — Full Browser escalation.** Run `pnpm verify:full` only when release or milestone closure, shared browser infrastructure, or another explicit full-regression trigger requires the unfiltered Chromium authority.

Canonical package loop:

```bash
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
```

`pnpm verify` is a Level 3 finalization gate, not the default command after every small edit. Resolve Level 2 affected consumers from `AGENTS.md`, not agent memory.

## Browser verification

Browser-observable changes require targeted Playwright verification for the affected behavior before the pull request is ready. Prefer the smallest exact spec or ownership-tag subset that proves the changed contract:

```bash
pnpm exec playwright test browser-tests/<affected>.spec.ts
pnpm exec playwright test --grep @traffic
pnpm exec playwright test --grep @road
pnpm exec playwright test --grep @rci
pnpm exec playwright test --grep @smoke
```

Record the targeted command/spec and result in the pull request. Expand the subset when multiple browser domains or shared interaction paths are affected.

For CI-backed targeted evidence, add one metadata line to the pull request body using only approved ownership tags:

```text
Targeted browser tags: traffic building
```

Lean CI validates the repository and publishes the exact preview build artifact first. Browser CI then enters targeted mode, validates the metadata against the approved tag allowlist, consumes that Lean artifact, and runs only the requested Playwright ownership-set union. Remove the metadata line after evidence is collected when future commits should stop rerunning that targeted subset; editing PR metadata does not change the candidate SHA.

**Full Browser is not the default gate for every PR.** Targeted browser verification is the normal browser-observable PR gate. Escalate to the unfiltered suite when release closure, milestone closure, or shared browser infrastructure makes the impact too broad to bound safely with targeted tests.

Full Browser also remains available through the `full-ci` pull-request label and manual `workflow_dispatch`. A nightly scheduled CI run executes the same unfiltered regression authority on the default branch so broad regression coverage is retained without forcing every PR through the long suite.

Targeted subsets are affected-behavior evidence; they must not be described as Full Browser or release-wide regression evidence.

## Pull request finalization

Before a pull request is ready:

- complete the targeted owner and affected-consumer checks required by the Verification Ladder;
- when behavior is browser-observable, complete targeted Playwright verification for every affected browser path and record the evidence;
- explicitly record whether Full Browser escalation is required and why;
- synchronize required `docs/systems/<system>/README.md` living documentation in the same pull request;
- run Level 3 and Level 4 only when their escalation triggers apply;
- remove debug, generated, and temporary artifacts that are not intentional evidence.

A browser-visible change does not automatically require Level 4. If the affected boundary is explicit and the targeted browser gate covers it, the PR can finalize without the unfiltered suite unless another release/milestone/shared-infrastructure trigger applies.

For exact-head verification, commit the complete candidate first and verify that exact clean head. Final CI run IDs, artifact IDs, counts, and other post-run metadata may be recorded in the pull request body or comments without creating a metadata-only commit that would invalidate the verified SHA.

## CI topology

Lean CI is the mandatory repository verification owner for normal pull requests. It runs `pnpm check` and publishes the exact Game/Terrain Lab browser preview artifacts.

Browser CI depends on Lean and has two mutually exclusive execution modes:

- **Targeted mode:** a PR body with approved `Targeted browser tags:` metadata consumes the Lean artifacts and runs only the selected ownership-tag union.
- **Full mode:** runs the unfiltered browser authority only when the PR has `full-ci`, a maintainer uses `workflow_dispatch`, or the nightly schedule executes.

Both modes reuse the Lean artifacts and do not rerun Lean-owned unit, typecheck, or build work.

## Vercel deployment policy

`vercel.json` disables automatic Git deployments for non-production branches and enables `master`:

```json
{
  "git": {
    "deploymentEnabled": {
      "*": false,
      "master": true
    }
  }
}
```

A branch matching multiple rules is deployed when at least one matching rule is `true`. Therefore:

- `master` matches both rules and remains the Production deployment branch;
- short-lived implementation branches match only `* = false`, so they do not become Production deployments.

The Vercel project Production Branch must remain `master`.

Production flow:

```text
accepted pull request → master
                      ↓
Vercel Git Integration
                      ↓
Production deployment
```

A Git tag may mark a release boundary on an accepted `master` commit. It does not introduce another integration or release branch.

## Exact-head evidence

When Level 4 applies, evidence must identify the exact candidate SHA and the actual required Full Browser result. For a browser-observable PR that does not trigger Level 4, record the exact targeted Playwright evidence required by the owning change instead. A tree change after successful exact-head verification creates a new candidate and requires the relevant verification again. Pull request body/comment metadata updates do not change the tree and are the preferred location for post-run CI identifiers.
