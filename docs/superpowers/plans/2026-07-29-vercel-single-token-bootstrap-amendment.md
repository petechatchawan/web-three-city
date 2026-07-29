# Vercel Single-Token Bootstrap Amendment

> **For agentic workers:** This amendment supersedes the Vercel project setup, three-secret handling, and manual label requirements in `2026-07-29-vercel-ci-gated-deployments-v0-1.md`.

**Goal:** Reduce owner setup to the existing `VERCEL_TOKEN` GitHub Actions secret while preserving CI-gated Preview security.

**Architecture:** Trusted workflow code links or creates `web-three-city` with pinned Vercel CLI, reads generated identifiers from `.vercel/project.json`, configures Preview-only Vercel Authentication through the documented Project API, and verifies the retained setting before deployment. The first trusted Production run creates the `preview-ready` GitHub label when absent.

**Tech Stack:** Node.js 22, Vercel CLI 58.0.0, Vercel Project API v9, GitHub Actions.

## Global Constraints

- The only owner-managed Vercel secret is `VERCEL_TOKEN`.
- Preview workflow still checks out only trusted `master`.
- Project bootstrap must be idempotent.
- Preview must fail closed unless `ssoProtection.deploymentType` is exactly `preview`.
- Generated `.vercel/project.json` is ignored and never committed.
- Production remains public.

---

### Task 1: Single-token bootstrap contract

**Files:**
- Create: `tooling/bootstrap-vercel-project.test.mjs`
- Create: `tooling/bootstrap-vercel-project.mjs`
- Modify: `package.json`

- [x] Define tests for project-link validation, API PATCH/GET verification, failure-closed protection, idempotent CLI linking, and absence of token material from returned output.
- [x] Observe RED while the bootstrap module is absent.
- [x] Implement `readProjectLink`, `configurePreviewProtection`, and `bootstrapVercelProject`.
- [x] Add `bootstrap:vercel` and include bootstrap tests in `test:deployment`.

### Task 2: One-secret workflow migration

**Files:**
- Modify: `.github/workflows/vercel.yml`

- [x] Remove `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from all workflow environments and validation.
- [x] Validate only `VERCEL_TOKEN`.
- [x] Run trusted bootstrap before Preview and Production deployment.
- [x] Restrict manual Production dispatch to `refs/heads/master`.
- [x] Create `preview-ready` from the first trusted Production run when absent.
- [x] Preserve exact-head artifact, same-repository PR, stale-head, fork, and one-shot label gates.

### Task 3: Documentation and verification

**Files:**
- Modify: `docs/deployment/vercel-ci-gated-deployments.md`
- Modify: `docs/superpowers/specs/2026-07-29-vercel-ci-gated-deployments-v0-1-design.md`

- [x] Replace manual project/protection/identifier setup with automated bootstrap documentation.
- [x] Record `VERCEL_TOKEN` as the only owner action.
- [ ] Run exact-head Quality, Unit/deployment, Build/Build Output API, and full Chromium CI.
- [ ] After explicit merge authorization, squash-merge the infrastructure PR and verify the first Production bootstrap/deployment.
- [ ] Apply `preview-ready` to Terraform PR #7 and verify protected Game and Terrain Lab URLs.
