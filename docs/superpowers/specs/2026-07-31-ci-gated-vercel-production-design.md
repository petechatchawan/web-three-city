# CI-Gated Vercel Production Design

**Status:** Approved for implementation on 2026-07-31

## Goal

Run repository verification automatically for every pull request and every `master` update, then deploy Vercel Production only from the exact `master` commit whose CI run completed successfully.

## Delivery Policy

- Pull-request commits run CI but do not deploy.
- Pushes to `master` run the same CI gates again.
- Production deployment starts only from a successful `CI` `workflow_run` whose event is `push`, branch is `master`, and head SHA is the verified source SHA.
- Manual production deployment is allowed only from `master` through `workflow_dispatch` and must rebuild and verify the deployment output before deployment.
- A newer run cancels an older CI run for the same branch or pull request.
- Production deployments are serialized and are never cancelled after starting.

## CI Gates

CI uses Node.js 22 and pnpm 10.13.1 with `pnpm install --frozen-lockfile`.

1. Quality: formatting, ESLint, repository TypeScript including browser tests, and provenance.
2. Unit: coverage-enabled workspace tests and deployment-tool tests.
3. Build: all packages/apps, relative asset-path validation, Vercel Build Output API composition, and deployment-output validation.
4. Browser: exact built Game and Terrain Lab applications, Chromium installation, full Playwright suite, and browser evidence upload.

The stable job names are intended for branch-protection required checks.

## Production Artifact Flow

The successful CI build job uploads `apps/game/dist` and `apps/terrain-lab/dist` as `web-app-builds`. The production workflow checks out the exact successful CI SHA, downloads that artifact by CI run ID, composes `.vercel/output`, links the existing `web-three-city` Vercel project using `VERCEL_TOKEN`, and deploys with `vercel deploy --prebuilt --prod`.

This prevents deployment from rebuilding a different source revision than the one that passed CI.

## Failure Behavior

- Any CI job failure blocks production deployment.
- Missing `VERCEL_TOKEN`, missing build artifacts, invalid Build Output API data, or a missing deployment URL fails the deployment job.
- Pull-request and feature-branch pushes never invoke production deployment.
- GitHub Actions logs and Playwright artifacts remain available for diagnosis.

## Repository Administration

After CI is green, branch protection for `master` should require the four CI job checks and require branches to be up to date before merging. Vercel Git auto-deploy should remain disabled to avoid duplicate deployments outside the gated GitHub Actions path.
