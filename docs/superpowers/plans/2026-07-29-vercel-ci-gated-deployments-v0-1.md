# Vercel CI-Gated Deployments v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Amendment:** Project creation/linking, Preview protection, project identifiers, and GitHub label setup in this original plan are superseded by `2026-07-29-vercel-single-token-bootstrap-amendment.md`. The only owner-managed secret is `VERCEL_TOKEN`.

**Goal:** Replace GitHub Pages with one-shot, exact-head, CI-gated Vercel Preview deployments and automatic Production deployment from `master`.

**Architecture:** Pull-request code is built only in the existing unprivileged CI workflow. A trusted Build Output API v3 composer converts verified CI artifacts into `.vercel/output`, and a privileged workflow deploys that prebuilt output with pinned Vercel CLI 58.0.0. A one-shot `preview-ready` label controls Preview frequency and is removed only after successful deployment.

**Tech Stack:** GitHub Actions, Node.js 22, pnpm 10.13.1, Vercel CLI 58.0.0, Vercel Build Output API v3, Vite static builds.

## Global Constraints

- Repository remains private.
- Vercel Personal/Hobby account owner is `petechatchawan`.
- Preview requires Vercel Authentication; Production remains public.
- Vercel automatic Git deployments are disabled.
- Privileged workflows never checkout or execute PR code.
- Preview deploys only an exact-head successful `CI` artifact.
- Game is `/`; Terrain Lab is `/terrain-lab/`.
- `preview-ready` is one-shot and removed only after success.
- The only owner-managed Vercel secret is `VERCEL_TOKEN`.

---

### Task 1: Deterministic Vercel output composer

**Files:**
- Create: `tooling/compose-vercel-output.mjs`
- Create: `tooling/compose-vercel-output.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: two Vite output directories containing `index.html` and relative `./assets/` references.
- Produces: `.vercel/output/config.json` with `{ "version": 3 }` and static files under `.vercel/output/static`.

- [x] **Step 1: Write failing Node tests**

Cover successful composition, removal of stale output, missing `index.html`, and rejection of root-absolute `/assets/` references.

- [x] **Step 2: Run the tests and verify RED**

Run: `node --test tooling/compose-vercel-output.test.mjs`

Expected: FAIL because `compose-vercel-output.mjs` does not exist.

- [x] **Step 3: Implement the composer**

Implement argument parsing for:

```text
--game <directory>
--terrain-lab <directory>
--output <directory>
```

Default to `apps/game/dist`, `apps/terrain-lab/dist`, and `.vercel/output`. Validate both inputs before replacing output. Copy Game to `static/`, Terrain Lab to `static/terrain-lab/`, and write Build Output API v3 config.

- [x] **Step 4: Add scripts**

Add `compose:vercel` and `test:deployment`, then include deployment tests in `check` before build.

- [x] **Step 5: Run GREEN verification**

Run:

```bash
pnpm test:deployment
pnpm build
pnpm compose:vercel
```

Expected: PASS and both `.vercel/output/static/index.html` and `.vercel/output/static/terrain-lab/index.html` exist.

### Task 2: Vercel configuration and CI artifact verification

**Files:**
- Create: `vercel.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: application builds from the existing build job.
- Produces: validated deployable artifacts and disabled Vercel Git auto-deployment.

- [x] **Step 1: Add Vercel configuration**

Create:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

- [x] **Step 2: Ignore generated output**

Add `.vercel/` to `.gitignore`.

- [x] **Step 3: Strengthen the CI build job**

After `pnpm build`, compose and verify Build Output API v3. Keep uploading `web-app-builds` from application dist directories.

- [x] **Step 4: Run quality checks**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
```

Expected: PASS.

### Task 3: One-shot CI-gated Vercel workflow

**Files:**
- Create: `.github/workflows/vercel.yml`
- Create: `tooling/bootstrap-vercel-project.mjs`
- Create: `tooling/bootstrap-vercel-project.test.mjs`

**Interfaces:**
- Consumes: `workflow_run` CI metadata, `pull_request_target:labeled`, `web-app-builds`, and `VERCEL_TOKEN`.
- Produces: linked/protected Vercel project, Preview/Production URLs, one maintained PR comment, and removal of `preview-ready` after success.

- [x] **Step 1: Add workflow triggers and minimal permissions**

Use push to `master`, successful `CI` workflow completion, `pull_request_target:labeled`, and master-only manual dispatch. Separate Preview and Production jobs.

- [x] **Step 2: Resolve and gate Preview**

Reject stale heads, fork PRs, closed PRs, failed CI, and missing labels. These non-ready states end without deployment.

- [x] **Step 3: Bootstrap from one token**

Checkout only trusted `master`, validate `VERCEL_TOKEN`, run pinned `vercel link`, read generated `.vercel/project.json`, configure `ssoProtection.deploymentType=preview`, and verify the setting through the Project API.

- [x] **Step 4: Deploy verified Preview artifact**

Download `web-app-builds` from exact-head CI, compose `.vercel/output`, and run:

```bash
pnpm dlx vercel@58.0.0 deploy --prebuilt --yes --token="$VERCEL_TOKEN"
```

- [x] **Step 5: Publish Preview result**

Update one marked comment with Game URL, Terrain Lab URL, source SHA, and CI run ID. Remove `preview-ready` only after success.

- [x] **Step 6: Deploy Production from trusted master**

Build, test, bootstrap, compose, ensure `preview-ready` exists, and run:

```bash
pnpm dlx vercel@58.0.0 deploy --prebuilt --prod --yes --token="$VERCEL_TOKEN"
```

### Task 4: Remove GitHub Pages and document operations

**Files:**
- Delete: `.github/workflows/pages.yml`
- Delete: `docs/deployment/pages-preview-deployments.md`
- Create: `docs/deployment/vercel-ci-gated-deployments.md`

- [x] Remove obsolete Pages implementation.
- [x] Document one-token automated Vercel bootstrap and Preview operations.
- [x] Record that `pages-state` is obsolete and may be deleted after live verification.

### Task 5: Exact-head verification and handoff

- [ ] Verify exact-head Quality, Unit/deployment, Build/Build Output API, and full Chromium CI.
- [x] Confirm no Preview step checks out the PR ref or executes PR scripts in the privileged job.
- [ ] After explicit merge authorization, squash-merge PR #9 and verify first Production bootstrap/deployment.
- [ ] Apply `preview-ready` to PR #7 and verify protected Game and Terrain Lab URLs.
