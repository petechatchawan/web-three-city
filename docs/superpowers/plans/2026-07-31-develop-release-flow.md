# Develop Release Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `develop` as the integration branch, keep `master` production-only, and let Vercel Git Integration deploy automatically only from `master` without GitHub Actions.

**Architecture:** Feature branches open pull requests into `develop`. Completed integration work is promoted through a release pull request from `develop` into `master`. Repository GitHub Actions workflows are removed because hosted-runner quota is unavailable; Vercel receives Git webhooks directly and `vercel.json` suppresses every branch except `master`.

**Tech Stack:** GitHub branches and pull requests, Vercel Git Integration, `vercel.json` static Git configuration.

## Global Constraints

- Do not merge PR #11 while changing branch topology.
- Create `develop` from exact current `master`.
- Retarget PR #11 from `master` to `develop`.
- Do not deploy feature branches or `develop`.
- Deploy Production automatically only for commits reaching `master`.
- Do not depend on GitHub-hosted Actions minutes.

---

### Task 1: Create the integration branch

**Files:** None.

**Interfaces:**
- Consumes: current `master` ref.
- Produces: persistent `develop` ref at the same starting commit as `master`.

- [ ] Create `develop` from exact `master`.
- [ ] Compare `master...develop`; expect zero divergence immediately after creation.

### Task 2: Move active implementation to the integration flow

**Files:** PR #11 metadata.

**Interfaces:**
- Consumes: PR #11 head `agent/road-network-foundation-v0-1`.
- Produces: PR #11 targeting `develop`.

- [ ] Retarget PR #11 base branch to `develop`.
- [ ] Confirm PR #11 remains open, unmerged, and mergeable.

### Task 3: Remove quota-dependent workflows

**Files:**
- Delete: `.github/workflows/ci.yml`
- Delete: `.github/workflows/vercel.yml`

**Interfaces:**
- Consumes: restored but unusable GitHub-hosted workflows.
- Produces: repository changes that no longer create permanently failing hosted-runner checks.

- [ ] Delete CI workflow from the feature branch.
- [ ] Delete Vercel Actions deployment workflow from the feature branch.
- [ ] Confirm the PR no longer proposes GitHub Actions workflow files.

### Task 4: Enable master-only Vercel Git deployments

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: Vercel Git Integration branch matching.
- Produces: `git.deploymentEnabled` rules that disable all branches except `master`.

- [ ] Replace global deployment disablement with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "*": false,
      "master": true
    }
  }
}
```

- [ ] Validate that `master` matches a `true` rule and all other branches match only the wildcard `false` rule.

### Task 5: Record and verify the release policy

**Files:**
- Create: `docs/development-workflow.md`
- Modify: PR #11 body/comment.

**Interfaces:**
- Produces: canonical contributor guidance for `feature/* → develop → master`.

- [ ] Document branch purposes, PR targets, release promotion, verification ownership, and Vercel behavior.
- [ ] Compare PR #11 against `develop` and confirm `master` is no longer the active implementation target.
- [ ] Confirm final branch state: `develop` exists, PR #11 targets `develop`, workflows are absent, and `vercel.json` enables only `master`.
