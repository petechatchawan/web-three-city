# Vercel CI-Gated Deployments v0.1 Design

## Status

Accepted by owner direction on 2026-07-29. Amended after owner supplied the `VERCEL_TOKEN` repository secret to automate all remaining Vercel setup.

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
- The only owner-managed Vercel credential is the GitHub repository secret `VERCEL_TOKEN`.

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

### Project bootstrap

Trusted deployment tooling runs `vercel link --yes --project web-three-city` with pinned Vercel CLI `58.0.0`. The command idempotently links or creates the project under the token's Personal/Hobby scope and writes generated `projectId` and `orgId` values to `.vercel/project.json`.

The bootstrap then calls the documented Project API at `PATCH /v9/projects/{projectId}` with:

```json
{
  "ssoProtection": {
    "deploymentType": "preview"
  }
}
```

It reads the project back through `GET /v9/projects/{projectId}` and fails closed unless Preview-only Vercel Authentication is retained. No project or owner identifier is stored as a GitHub secret.

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

A push to `master` checks out trusted `master`, installs locked dependencies, builds both applications, runs deployment tests, bootstraps the Vercel project, composes Build Output API v3, ensures the `preview-ready` label exists, and deploys with `vercel deploy --prebuilt --prod`.

Manual Production dispatch is accepted only from `refs/heads/master`.

### Vercel invocation

The workflow uses exact Vercel CLI version `58.0.0` through `pnpm dlx`. It authenticates through one repository secret:

- `VERCEL_TOKEN`

The source code is not uploaded for Preview deployments; only the prebuilt Build Output API directory is uploaded.

## Security model

- `workflow_run` and `pull_request_target` may access secrets, so neither path checks out the PR ref.
- Trusted deployment tooling is checked out only from `master`.
- Build artifacts are accepted only from the repository's named `CI` workflow and an exact current PR head.
- Fork PR previews are rejected.
- Vercel Git deployments are disabled through `vercel.json` so Vercel cannot deploy every commit independently of GitHub gates.
- The Vercel token is never printed and is passed only through environment variables and the CLI `--token` option.
- Project API responses are validated and Preview deployment stops when protection cannot be proven.

## Pull-request feedback

The workflow maintains one PR comment marked by `<!-- web-three-city-vercel-preview -->` containing:

- Preview Game URL
- Preview Terrain Lab URL
- exact source SHA
- exact CI run ID

The comment is updated rather than duplicated.

## Failure behavior

- Missing `VERCEL_TOKEN` fails before project bootstrap or deployment with a direct setup message.
- Invalid or expired tokens fail during project link/API bootstrap without revealing token material.
- Missing exact-head CI leaves the one-shot label in place so the later successful CI run can deploy.
- Missing build artifact fails deployment and preserves the label for retry.
- Failed protection verification or Vercel deployment preserves the label.
- The label is removed only after Vercel returns a deployment URL and the PR comment is updated.

## Migration

- Delete `.github/workflows/pages.yml`.
- Replace `docs/deployment/pages-preview-deployments.md` with Vercel setup and operations documentation.
- Stop using the `pages-state` branch. The stale branch may be deleted after Vercel Production and PR Preview are verified.

## One-time owner setup

Before merging the migration PR, the owner adds only `VERCEL_TOKEN` as a GitHub Actions repository secret. Project creation/linking, Preview-only Vercel Authentication, project identifiers, and the `preview-ready` label are automated by trusted workflow code.

## Acceptance criteria

- Repository CI passes with the migration.
- Tests prove the composer creates correct Build Output API v3 output and rejects invalid input.
- Tests prove the single-token bootstrap validates link state, configures Preview protection, verifies the retained setting, and returns no token material.
- No GitHub Pages workflow remains.
- `vercel.json` disables Vercel Git automatic deployments.
- The first trusted Production run creates or links the project and creates `preview-ready` when absent.
- Adding `preview-ready` to an exact-head green PR creates one protected Preview deployment and removes the label.
- The PR comment links Game and Terrain Lab.
- Merging to `master` creates a public Production deployment.
