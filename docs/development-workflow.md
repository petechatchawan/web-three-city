# Development and Release Workflow

## Branch roles

### `develop`

`develop` is the active integration branch. New product work, fixes, and refactors are accumulated here until the current release scope is complete and verified.

- Active implementation targets `develop`.
- Long-running feature branches, when used, branch from `develop` and open pull requests back into `develop`.
- Incomplete work must not be promoted to `master`.
- Merging into `develop` does not trigger a Vercel deployment.

### `master`

`master` is the production release branch.

- No routine feature implementation is performed directly on `master`.
- Changes reach `master` only through a release pull request from `develop`.
- A release pull request is opened only after the selected scope is complete and verification evidence is accepted.
- Merging into `master` triggers the automatic Vercel Production deployment through Vercel Git Integration.

## Normal flow

```text
feature branch (optional)
        ↓ pull request
develop
        ↓ release pull request after completion and verification
master
        ↓ automatic Git deployment
Vercel Production
```

For small changes, work may be committed directly to `develop` when explicitly authorized. `master` remains release-only.

## Pull request targets

- Product feature, bug fix, refactor, test, or documentation work: target `develop`.
- Production release: source `develop`, target `master`.
- Emergency production fixes should still be prepared on a dedicated branch, merged to `master`, and then synchronized back into `develop` to prevent divergence.

## Verification policy

GitHub-hosted Actions are not a required execution path because the private-repository runner quota is limited. Verification commands remain repository-owned and must be run from an available execution environment before a release merge.

The full release gate is:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build:browser
pnpm exec playwright install chromium
pnpm test:browser:only
git diff --check
git status --short
```

Exact commit SHA and test/build evidence must be recorded before merging `develop` into `master`.

## Vercel deployment policy

`vercel.json` disables automatic Git deployments for every branch except `master`:

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

- `master` matches `* = false` and `master = true`, so it deploys.
- `develop` and all feature branches match only `* = false`, so they do not deploy.

The Vercel project Production Branch must remain `master`.
