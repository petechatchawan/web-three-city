# CI-Gated Vercel Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore automated repository verification and deploy Vercel Production only from a successful exact-head `master` CI artifact.

**Architecture:** `.github/workflows/ci.yml` runs four independent verification jobs on pull requests and `master` pushes. `.github/workflows/vercel.yml` listens for a successful push-triggered CI run on `master`, downloads the build artifact from that run, composes Vercel Build Output API output, and performs a prebuilt production deployment.

**Tech Stack:** GitHub Actions, Node.js 22, pnpm 10.13.1, TypeScript 6.0.3, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.5, Vercel CLI 58.0.0.

## Global Constraints

- PR commits run CI and never deploy Production.
- Production deploys only from a successful exact-head `master` CI run or explicit manual dispatch on `master`.
- Use `pnpm install --frozen-lockfile`.
- Preserve `VERCEL_TOKEN` as the only required Vercel repository secret.
- Upload Playwright evidence even when the browser job fails.
- Do not merge PR #11 until all exact-head gates pass and the owner authorizes merge.

---

### Task 1: Restore and strengthen CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root package scripts `format:check`, `lint`, `typecheck`, `provenance:check`, `test:coverage`, `test:deployment`, `build`, `compose:vercel`, and `test:browser:only`.
- Produces: stable jobs `Quality and provenance`, `Unit, geometry, and golden tests`, `Build all packages and applications`, and `Chromium smoke, interaction, and visual evidence`; artifact `web-app-builds`.

- [ ] **Step 1: Restore workflow triggers**

Configure `pull_request`, `push` to `master`, and `workflow_dispatch`, with per-ref concurrency cancellation.

- [ ] **Step 2: Restore source verification jobs**

Use Node.js 22, pnpm 10.13.1, and frozen-lockfile installation in each job. Run all quality, unit, deployment, and build commands.

- [ ] **Step 3: Build and upload exact deployable artifacts**

Validate relative asset paths, compose `.vercel/output`, validate version 3 output, and upload Game/Terrain Lab dist directories as `web-app-builds`.

- [ ] **Step 4: Run built-application Playwright gates**

Build both browser applications once, install Chromium with OS dependencies, run `pnpm test:browser:only`, and upload `playwright-report` plus `test-results` with `if: always()`.

- [ ] **Step 5: Commit**

Commit the restored CI workflow.

### Task 2: Gate Vercel Production on successful CI

**Files:**
- Create: `.github/workflows/vercel.yml`

**Interfaces:**
- Consumes: successful `CI` workflow run metadata, `web-app-builds` artifact, `VERCEL_TOKEN`, `tooling/bootstrap-vercel-project.mjs`, and `tooling/compose-vercel-output.mjs`.
- Produces: one serialized public Vercel Production deployment for the exact successful `master` SHA.

- [ ] **Step 1: Configure production triggers and gate**

Listen to completed `CI` workflow runs and manual dispatch. Permit automatic deployment only when the upstream event is `push`, branch is `master`, and conclusion is `success`.

- [ ] **Step 2: Resolve exact source and CI artifact**

Checkout `workflow_run.head_sha`, install pinned Node/pnpm, download `web-app-builds` using the upstream run ID, and fail if the artifact is absent.

- [ ] **Step 3: Compose and validate Vercel output**

Run deployment-tool tests, compose `.vercel/output` from the downloaded Game and Terrain Lab artifacts, and validate the Build Output API files.

- [ ] **Step 4: Deploy prebuilt Production**

Validate `VERCEL_TOKEN`, link/configure the `web-three-city` project, deploy with Vercel CLI 58.0.0 using `--prebuilt --prod`, validate the returned HTTPS URL, and write Game/Terrain Lab URLs to the job summary.

- [ ] **Step 5: Support safe manual recovery**

For `workflow_dispatch` on `master`, build and verify locally in the workflow before composing/deploying because there is no upstream artifact run ID.

- [ ] **Step 6: Commit**

Commit the production workflow.

### Task 3: Verify live automation

**Files:**
- Modify only if failures identify defects in workflow or source.

**Interfaces:**
- Consumes: GitHub Actions run metadata, job steps, job logs, and artifacts.
- Produces: exact-head verification evidence and a merge/deploy readiness decision.

- [ ] **Step 1: Observe the pull-request CI run**

Confirm all four jobs start on the latest PR head and inspect logs for any formatting, typing, test, build, or browser failures.

- [ ] **Step 2: Fix failures from logs**

Apply the smallest source/workflow correction, push it, and observe the new exact-head run. Repeat until all four jobs pass.

- [ ] **Step 3: Record evidence**

Update `docs/evidence/road-network-foundation-v0-1.md` with the exact SHA, job results, test counts, artifact names, and limitations.

- [ ] **Step 4: Hold merge**

Keep PR #11 open until owner merge authorization. Production deployment will occur automatically after the green PR is merged to `master` and the push-triggered CI run succeeds.
