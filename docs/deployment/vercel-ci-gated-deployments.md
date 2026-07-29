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

The workflow that can read Vercel secrets checks out only trusted `master`. It never checks out or executes pull-request code.

PR code is built in the ordinary unprivileged `CI` workflow. The deployment workflow downloads only the `web-app-builds` artifact from a successful exact-head CI run, composes Vercel Build Output API v3, and deploys with `vercel deploy --prebuilt`.

Fork PRs, stale CI runs, closed PRs, and PRs without `preview-ready` are not deployed.

## One-time Vercel project setup

1. Sign in to the Vercel Personal/Hobby account owned by `petechatchawan`.
2. Create one project and import the private repository `petechatchawan/web-three-city`.
3. Keep the repository root as the Vercel project root.
4. Confirm the Production Branch is `master`.
5. Confirm automatic Git deployments are disabled. The repository enforces this with `vercel.json`:

   ```json
   {
     "git": {
       "deploymentEnabled": false
     }
   }
   ```

6. Open Project Settings → Deployment Protection.
7. Enable Vercel Authentication for **Preview deployments only**.
8. Leave Production unprotected/public.

## One-time GitHub secrets

The repository requires these Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Create a Vercel token from the Vercel account token settings. Obtain the organization and project IDs from the linked Vercel project. A one-time `vercel link` also writes both values to `.vercel/project.json`; that generated directory must not be committed.

Add each value at:

`GitHub repository → Settings → Secrets and variables → Actions → New repository secret`

The deployment workflow fails before upload with a named error when any required secret is missing.

## One-time GitHub label

Create the label:

```text
preview-ready
```

Recommended description:

```text
Deploy the exact green PR head to protected Vercel Preview once
```

The label is intentionally consumed after successful deployment.

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

Applying the label before CI finishes is also safe. The label event waits without deploying; the later successful exact-head CI completion performs the deployment.

## Requesting another Preview

After additional commits:

1. Wait for the new exact-head CI run to pass.
2. Apply `preview-ready` again.

No deployment occurs merely because another commit was pushed.

## Production

A push to `master` builds from trusted `master`, runs the deployment composer tests, creates Build Output API v3, and deploys with:

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

### Workflow reports a missing secret

Add the named secret under GitHub Actions repository secrets and reapply `preview-ready`.

### Preview opens a Vercel login screen

This is expected. Sign in with the Vercel account that owns or has access to the project.

### Production is protected unexpectedly

Change Vercel Authentication to protect Preview deployments only, not all deployments.

## GitHub Pages migration cleanup

GitHub Pages is no longer used. The obsolete `pages-state` branch may be deleted after both Vercel Production and one PR Preview are verified. It is not read by the Vercel workflow.
