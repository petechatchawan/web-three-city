# Vercel CI-Gated Deployments v0.1 Design

## Status

Accepted by owner direction on 2026-07-29.

## Goal

Replace the unusable private-repository GitHub Pages deployment with a Vercel Personal/Hobby deployment model that does not create a deployment for every development commit.

## Locked behavior

- The repository remains private.
- The Vercel project belongs to the personal Hobby account for `petechatchawan`.
- Vercel Git automatic deployments are disabled.
- Preview deployment is a one-shot owner-review action controlled by the `preview-ready` pull-request label.
- Preview deployment requires an exact-head successful `CI` run.
- The privileged deployment workflow never checks out or executes pull-request code.
- The privileged workflow deploys only the `web-app-builds` artifact produced by the successful CI run.
- After a successful Preview deployment, the workflow removes `preview-ready`; another deployment requires applying the label again.
- Pushes to `master` deploy Production automatically.
- Preview deployments use Vercel Authentication and Production remains public.
- Game is served from `/` and Terrain Lab from `/terrain-lab/` in one Vercel project.

## Architecture

### Build boundary

The existing CI build job remains the authority for pull-request application builds. It uploads `apps/game/dist` and `apps/terrain-lab/dist` as `web-app-builds` only after the repository build completes.

A trusted Node.js composer creates a Vercel Build Output API v3 directory:

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

The composer validates both application entry points and rejects root-absolute `/assets/` references.

### Preview trigger

Preview can start in either of two orders:

1. `preview-ready` is applied after CI already passed: `pull_request_target:labeled` resolves the current PR head and locates a successful exact-head CI run.
2. `preview-ready` is applied before CI finishes: `workflow_run:completed` detects the label after the exact-head CI run succeeds.

Both paths converge on the same gates:

- PR is open.
- PR head repository is this repository.
- current PR head SHA equals CI `head_sha`.
- CI conclusion is `success`.
- PR contains `preview-ready`.
- `web-app-builds` exists for that CI run.

### Production trigger

A push to `master` checks out trusted `master`, installs locked dependencies, builds both applications, composes Build Output API v3, and deploys with `vercel deploy --prebuilt --prod`.

### Vercel invocation

The workflow uses the exact Vercel CLI version `58.0.0` through `pnpm dlx`. It authenticates through repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The source code is not uploaded for Preview deployments; only the prebuilt Build Output API directory is uploaded.

## Security model

- `workflow_run` and `pull_request_target` may access secrets, so neither path checks out the PR ref.
- Trusted deployment tooling is checked out only from `master`.
- Build artifacts are accepted only from the repository's named `CI` workflow and an exact current PR head.
- Fork PR previews are rejected.
- Vercel Git deployments are disabled through `vercel.json` so Vercel cannot deploy every commit independently of GitHub gates.
- The Vercel token is never printed and is passed only through the CLI `--token` option.

## Pull-request feedback

The workflow maintains one PR comment marked by `<!-- web-three-city-vercel-preview -->` containing:

- Preview Game URL
- Preview Terrain Lab URL
- exact source SHA
- exact CI run ID

The comment is updated rather than duplicated.

## Failure behavior

- Missing Vercel secrets fail before deployment with a direct setup message.
- Missing exact-head CI leaves the one-shot label in place so the later successful CI run can deploy.
- Missing build artifact fails deployment and preserves the label for retry.
- Failed Vercel deployment preserves the label.
- The label is removed only after Vercel returns a deployment URL and the PR comment is updated.

## Migration

- Delete `.github/workflows/pages.yml`.
- Replace `docs/deployment/pages-preview-deployments.md` with Vercel setup and operations documentation.
- Stop using the `pages-state` branch. The stale branch may be deleted manually after Vercel Production and PR Preview are verified.

## One-time owner setup

Before merging the migration PR:

1. Create/import one Vercel project for `petechatchawan/web-three-city` under the Personal/Hobby account.
2. Confirm the project production branch is `master`.
3. Enable Vercel Authentication for Preview deployments only.
4. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub repository secrets.
5. Create the GitHub label `preview-ready`.

## Acceptance criteria

- Repository CI passes with the migration.
- Local/test fixtures prove the composer creates correct Build Output API v3 output and rejects invalid input.
- No GitHub Pages workflow remains.
- `vercel.json` disables Vercel Git automatic deployments.
- Adding `preview-ready` to an exact-head green PR creates one protected Preview deployment and removes the label.
- The PR comment links Game and Terrain Lab.
- Merging to `master` creates a public Production deployment.
