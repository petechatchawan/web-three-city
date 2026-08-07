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
- **Level 4 — Browser/release/milestone closure.** Run `pnpm verify:full` when browser acceptance, release closure, milestone closure, or another explicit Level 4 trigger applies.

Canonical package loop:

```bash
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
```

`pnpm verify` is a Level 3 finalization gate, not the default command after every small edit. Resolve Level 2 affected consumers from `AGENTS.md`, not agent memory.

## Pull request finalization

Before a pull request is ready:

- complete the targeted owner and affected-consumer checks required by the Verification Ladder;
- synchronize required `docs/systems/<system>/README.md` living documentation in the same pull request;
- run Level 3 and Level 4 only when their escalation triggers apply;
- remove debug, generated, and temporary artifacts that are not intentional evidence.

For exact-head verification, commit the complete candidate first and verify that exact clean head. Final CI run IDs, artifact IDs, counts, and other post-run metadata may be recorded in the pull request body or comments without creating a metadata-only commit that would invalidate the verified SHA.

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

When Level 4 applies, evidence must identify the exact candidate SHA and the actual required verification result. A tree change after successful exact-head verification creates a new candidate and requires the relevant verification again. Pull request body/comment metadata updates do not change the tree and are the preferred location for post-run CI identifiers.
