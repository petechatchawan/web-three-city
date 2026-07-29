# Vercel CI-Gated Deployments v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

---

### Task 1: Deterministic Vercel output composer

**Files:**
- Create: `tooling/compose-vercel-output.mjs`
- Create: `tooling/compose-vercel-output.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: two Vite output directories containing `index.html` and relative `./assets/` references.
- Produces: `.vercel/output/config.json` with `{ "version": 3 }` and static files under `.vercel/output/static`.

- [ ] **Step 1: Write failing Node tests**

Cover successful composition, removal of stale output, missing `index.html`, and rejection of root-absolute `/assets/` references.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tooling/compose-vercel-output.test.mjs`

Expected: FAIL because `compose-vercel-output.mjs` does not exist.

- [ ] **Step 3: Implement the composer**

Implement argument parsing for:

```text
--game <directory>
--terrain-lab <directory>
--output <directory>
```

Default to `apps/game/dist`, `apps/terrain-lab/dist`, and `.vercel/output`. Validate both inputs before replacing output. Copy Game to `static/`, Terrain Lab to `static/terrain-lab/`, and write Build Output API v3 config.

- [ ] **Step 4: Add scripts**

Add:

```json
"compose:vercel": "node tooling/compose-vercel-output.mjs",
"test:deployment": "node --test tooling/compose-vercel-output.test.mjs"
```

Include `pnpm test:deployment` in `check` before build.

- [ ] **Step 5: Run GREEN verification**

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

- [ ] **Step 1: Add Vercel configuration**

Create:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

- [ ] **Step 2: Ignore generated output**

Add `.vercel/` to `.gitignore`.

- [ ] **Step 3: Strengthen the CI build job**

After `pnpm build`, run `pnpm test:deployment` and compose output from the application build. Verify Build Output API config version 3 and both application entry points. Keep uploading `web-app-builds` from application dist directories.

- [ ] **Step 4: Run quality checks**

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

**Interfaces:**
- Consumes: `workflow_run` CI metadata, `pull_request_target:labeled`, `web-app-builds`, and Vercel repository secrets.
- Produces: Preview/Production deployment URLs, one maintained PR comment, and removal of `preview-ready` after success.

- [ ] **Step 1: Add workflow triggers and minimal permissions**

Use:

```yaml
on:
  push:
    branches: [master]
  workflow_run:
    workflows: [CI]
    types: [completed]
  pull_request_target:
    branches: [master]
    types: [labeled]
  workflow_dispatch:
```

Separate Preview and Production jobs. Preview requires `actions: read`, `contents: read`, `issues: write`, and `pull-requests: write`. Production requires `contents: read`.

- [ ] **Step 2: Resolve and gate Preview**

For `workflow_run`, use the run PR number and run ID. For `pull_request_target:labeled`, proceed only for label `preview-ready`, resolve current head SHA, and locate a successful exact-head CI run via GitHub API.

Reject stale heads, fork PRs, closed PRs, failed CI, and missing labels. These non-ready states end without deployment.

- [ ] **Step 3: Deploy verified Preview artifact**

Checkout only `master`, set up Node.js/pnpm, download `web-app-builds` from the selected CI run, compose `.vercel/output`, verify the three required secrets, and run:

```bash
pnpm dlx vercel@58.0.0 deploy --prebuilt --yes --token="$VERCEL_TOKEN"
```

Pass `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as environment variables.

- [ ] **Step 4: Publish Preview result**

Update one comment marked `<!-- web-three-city-vercel-preview -->` with Game URL, Terrain Lab URL, source SHA, and CI run ID. Remove `preview-ready` only after the comment succeeds.

- [ ] **Step 5: Deploy Production from trusted master**

Checkout `master`, install locked dependencies, build applications, run deployment tests, compose output, and run:

```bash
pnpm dlx vercel@58.0.0 deploy --prebuilt --prod --yes --token="$VERCEL_TOKEN"
```

Write Game and Terrain Lab URLs into the workflow summary.

### Task 4: Remove GitHub Pages and document owner setup

**Files:**
- Delete: `.github/workflows/pages.yml`
- Delete: `docs/deployment/pages-preview-deployments.md`
- Create: `docs/deployment/vercel-ci-gated-deployments.md`

**Interfaces:**
- Produces: one authoritative setup and operating guide.

- [ ] **Step 1: Remove obsolete Pages implementation**

Delete the Pages workflow and its guide so there is no competing deployment path.

- [ ] **Step 2: Document Vercel setup**

Document project import, production branch `master`, Preview-only Vercel Authentication, the three GitHub secrets, `preview-ready`, how to request another Preview, and how to verify `/` plus `/terrain-lab/`.

- [ ] **Step 3: Document migration cleanup**

Record that `pages-state` is obsolete and may be deleted after Vercel Production and Preview verification.

### Task 5: Exact-head verification and handoff

**Files:**
- Review all files changed by Tasks 1–4.

- [ ] **Step 1: Run repository gates**

Run:

```bash
pnpm check
pnpm test:browser
```

Expected: all repository gates pass.

- [ ] **Step 2: Inspect workflow security boundaries**

Confirm no Preview step checks out the PR ref, no PR scripts run in the privileged job, exact-head comparison exists, and the label is removed only after deployment success.

- [ ] **Step 3: Open infrastructure PR**

Open a PR targeting `master`, keep it unmerged until the owner creates the Vercel project, enables Preview authentication, and configures all three GitHub secrets.

- [ ] **Step 4: Merge and exercise PR #7 Preview**

After exact-head CI and setup confirmation, squash-merge the infrastructure PR, apply `preview-ready` to PR #7, verify Vercel Preview, and provide the Game and Terrain Lab URLs for owner acceptance.
