# Vercel CI-Gated Deployments

## Purpose

Provide browser-accessible Game and Terrain Lab deployments from a private GitHub repository without creating a Vercel deployment for every development commit.

## Deployment model

- Production deploys automatically after a push to `master`.
- Preview does not deploy for ordinary commits.
- Preview deploys only when an open same-repository PR has the `preview-ready` label and its exact current head has a successful `CI` run.
- `preview-ready` is removed after a successful deployment. Apply it again only when another owner-review deployment is required.
- Game is served at `/`.
- Terrain Lab is served at `/terrain-lab/`.
- Preview requires Vercel Authentication.
- Production remains public.

## Security boundary

The workflow that can read `VERCEL_TOKEN` checks out only trusted `master`. It never checks out or executes pull-request code.

PR code is built in the ordinary unprivileged `CI` workflow. The deployment workflow downloads only the `web-app-builds` artifact from a successful exact-head CI run, composes Vercel Build Output API v3, and deploys with `vercel deploy --prebuilt`.

Fork PRs, stale CI runs, closed PRs, and PRs without `preview-ready` are not deployed.

## One-time owner setup

Only one GitHub Actions repository secret is required:

```text
VERCEL_TOKEN
```

Create the token in the Vercel Personal/Hobby account owned by `petechatchawan`, then add it at:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

Do not commit or paste the token into source files, issues, pull requests, or chat messages.

## Automated Vercel bootstrap

The trusted deployment workflow performs the remaining setup automatically and idempotently:

1. `vercel link --yes --project web-three-city` finds or creates the Personal/Hobby project.
2. Vercel writes `.vercel/project.json` with `projectId` and `orgId`; the directory is generated and ignored by Git.
3. The workflow updates the project through `PATCH /v9/projects/{projectId}` with Preview-only Vercel Authentication.
4. The workflow reads the project back and fails closed unless `ssoProtection.deploymentType` is `preview`.
5. Production remains public because only Preview deployments are protected.
6. The first Production workflow creates the GitHub label `preview-ready` when it does not already exist.

The repository does not connect Vercel Git automatic deployments. `vercel.json` also declares `git.deploymentEnabled: false`, so pushes alone do not create Vercel Preview deployments.

## Requesting a Preview

1. Finish implementation on the PR.
2. Wait for exact-head `CI` to pass.
3. Apply `preview-ready`.
4. The `Vercel deployments` workflow downloads the successful CI artifact and deploys it.
5. One marked PR comment is created or updated with:
   - Game URL
   - Terrain Lab URL
   - source SHA
   - CI run ID
6. Sign in to Vercel when opening the Preview URL.
7. After successful deployment, `preview-ready` is removed automatically.

Applying the label before CI finishes is also safe. The label event exits without deploying; the later successful exact-head CI completion performs the deployment while the label remains present.

## Requesting another Preview

After additional commits:

1. Wait for the new exact-head CI run to pass.
2. Apply `preview-ready` again.

No deployment occurs merely because another commit was pushed.

## Production

A push to `master` builds from trusted `master`, runs deployment composer and bootstrap tests, creates Build Output API v3, ensures the Preview label exists, and deploys with:

```text
vercel deploy --prebuilt --prod
```

The workflow summary records the Production Game and Terrain Lab URLs.

## Build output contract

The repository composer creates:

```text
.vercel/output/
  config.json
  static/
    index.html
    assets/
    terrain-lab/
      index.html
      assets/
```

`config.json` uses Build Output API version `3`. Both Vite applications must use relative `./assets/` references. Root-absolute `/assets/` references fail CI.

## Troubleshooting

### Label applied but no deployment starts

Verify the PR is open, is not from a fork, and the current head has a successful `CI` run. A stale successful run cannot deploy a newer head.

### Workflow reports a missing token

Confirm the repository Actions secret is named exactly `VERCEL_TOKEN`, then reapply `preview-ready`.

### Bootstrap cannot create or link the project

Confirm the Vercel token belongs to the Personal/Hobby account `petechatchawan`, has not expired, and permits project management.

### Preview protection verification fails

Open Vercel Project Settings → Deployment Protection and confirm the account plan allows Vercel Authentication for Preview. The workflow intentionally stops instead of deploying an unprotected Preview.

### Preview opens a Vercel login screen

This is expected. Sign in with the Vercel account that owns or has access to the project.

## GitHub Pages migration cleanup

GitHub Pages is no longer used. The obsolete `pages-state` branch may be deleted after both Vercel Production and one PR Preview are verified. It is not read by the Vercel workflow.
