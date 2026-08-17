# Browser Verification Policy v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make targeted browser acceptance the normal browser-observable PR gate while reserving the unfiltered Full Browser suite for explicit release/shared-infrastructure escalation, manual runs, and nightly regression.

**Architecture:** Keep Lean CI as the repository verification owner. Preserve the existing conditional Full Browser job and artifact handoff, add a nightly trigger, and change repository policy/tests/templates so Full Browser is no longer implied by every browser-visible change. Do not introduce automatic changed-file-to-tag inference in v0.2.

**Tech Stack:** GitHub Actions YAML, Node.js `node:test` tooling contracts, Playwright, pnpm, Markdown repository policy.

## Global Constraints

- Full Browser must remain available via `full-ci`, `workflow_dispatch`, scheduled nightly regression, and `pnpm verify:full`.
- Pull-request synchronization must not run Full Browser unless `full-ci` is present.
- Lean CI remains mandatory and owns `pnpm check` and build artifacts.
- Browser CI must consume Lean artifacts and must not rerun Lean-owned verification.
- Browser-observable changes require targeted Playwright evidence before PR readiness.
- Do not change Playwright workers, retries, global timeout strategy, gameplay behavior, or Save semantics.
- Keep documentation under `docs/systems/development-workflow/`.

---

### Task 1: RED — lock the new verification contract

**Files:**
- Modify: `tooling/ci-topology.test.mjs`
- Modify: `tooling/development-workflow.test.mjs`

**Interfaces:**
- Consumes: `.github/workflows/ci.yml`, `AGENTS.md`, `.github/pull_request_template.md`, `docs/development-workflow.md`.
- Produces: failing contract tests that describe the v0.2 policy before implementation changes.

- [ ] **Step 1: Add CI topology assertions**

Add assertions that:

```js
assert.match(workflow, /schedule:/);
assert.match(workflow, /cron:/);
assert.match(jobs.browser.if, /workflow_dispatch/);
assert.match(jobs.browser.if, /full-ci/);
```

Also assert that the Browser job is still conditional for PRs and still depends on Lean.

- [ ] **Step 2: Add development workflow policy assertions**

Add assertions that `AGENTS.md` and `docs/development-workflow.md` explicitly state:

```text
targeted browser verification is required for browser-observable changes
Full Browser is not the default gate for every PR
Full Browser escalation covers release/milestone/shared browser infrastructure
```

Add PR-template assertions for separate targeted-browser evidence and Full Browser escalation fields.

- [ ] **Step 3: Run focused RED tests**

Run:

```bash
node --test tooling/ci-topology.test.mjs tooling/development-workflow.test.mjs
```

Expected: FAIL on missing nightly schedule and missing v0.2 policy/template wording.

---

### Task 2: GREEN — implement CI and policy semantics

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `AGENTS.md`
- Modify: `docs/development-workflow.md`
- Modify: `.github/pull_request_template.md`
- Modify: `docs/systems/development-workflow/README.md`

**Interfaces:**
- Consumes: failing contract tests from Task 1.
- Produces: v0.2 verification policy enforced by repository docs and CI topology.

- [ ] **Step 1: Add nightly Full Browser schedule**

Add a scheduled workflow trigger:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
  schedule:
    - cron: '0 18 * * *'
  workflow_dispatch:
```

Extend the Browser job condition so `schedule` runs the full suite while ordinary PR synchronization still requires `full-ci`:

```yaml
if: >-
  github.event_name == 'workflow_dispatch' ||
  github.event_name == 'schedule' ||
  (github.event_name == 'pull_request' &&
  contains(github.event.pull_request.labels.*.name, 'full-ci'))
```

- [ ] **Step 2: Update `AGENTS.md` browser policy**

Change Targeted Browser Feedback from optional affected feedback to the mandatory browser-observable PR gate. Replace wording that says targeted subsets never replace full release authority with explicit escalation semantics:

```text
browser-visible PR change → targeted affected Playwright gate
release/milestone/shared-browser-infra/full-ci/manual/nightly → Full Browser
```

Update Level 4 so browser-visible behavior alone does not trigger Full Browser; Level 4 requires explicit full-regression scope.

- [ ] **Step 3: Update human workflow documentation**

Make `docs/development-workflow.md` mirror the same Level 3 / targeted-browser / Full Browser escalation model and exact-head requirements.

- [ ] **Step 4: Update PR template**

Replace the generic browser checkbox with separate fields:

```markdown
- [ ] Targeted browser verification passed for browser-observable affected behavior, or browser verification is not applicable.
- [ ] Full Browser escalation decision recorded (`required` / `not required`) with reason.
```

Keep a commands/results section for exact evidence.

- [ ] **Step 5: Update Development Workflow living handoff**

Record v0.2 as the current policy, link the approved spec/TDD plan, and move the old “browser-suite tagging/sharding redesign” limitation wording so it does not contradict the v0.2 targeted-gate decision.

- [ ] **Step 6: Run focused GREEN tests**

Run:

```bash
node --test tooling/ci-topology.test.mjs tooling/development-workflow.test.mjs
```

Expected: PASS.

---

### Task 3: Repository verification

**Files:**
- No new production files.

**Interfaces:**
- Consumes: completed v0.2 workflow/policy implementation.
- Produces: Lean-level evidence without running the 144-test Full Browser suite.

- [ ] **Step 1: Run deployment/tooling contracts**

```bash
pnpm test:deployment
```

Expected: PASS.

- [ ] **Step 2: Run canonical Level 3 gate**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 3: Confirm Full Browser is not triggered by ordinary PR synchronization**

Verify `.github/workflows/ci.yml` condition remains:

```text
pull_request + full-ci only
```

and scheduled/manual events remain valid Full Browser entry points.

---

### Task 4: Apply policy to PR #79

**Files:**
- PR metadata only; no repository tree mutation required after exact-head verification.

**Interfaces:**
- Consumes: Browser Verification Policy v0.2 and current PR #79 failure inventory.
- Produces: accurate PR gate status that no longer treats Full Browser 144 as mandatory for iteration/closure.

- [ ] **Step 1: Keep `full-ci` removed during remediation**

Do not re-add `full-ci` while fixing the remaining Citizen Mobility/Traffic affected tests.

- [ ] **Step 2: Record the targeted release gate**

PR #79 browser evidence must cover:

```text
Citizen Mobility commute morning/evening
WorldSaveV7 deterministic continuation
road recovery
5k traffic performance
mobile portrait + landscape containment
Traffic information/Thai locale modal flow
Growth clock/reservation regression
```

- [ ] **Step 3: Preserve non-browser release gates**

Keep Lean CI, Sonar, clean candidate state, performance evidence, and owner manual visual acceptance at 414×896 as required by PR #79.

- [ ] **Step 4: Do not run Full Browser unless escalation becomes necessary**

Re-add `full-ci` only if the remediation changes shared browser infrastructure or a maintainer explicitly requests release-wide regression evidence.

---

## Self-review

- Spec coverage: all acceptance criteria map to Tasks 1–4.
- Placeholder scan: no TBD/TODO/implementation-later placeholders.
- Scope: limited to Development Workflow verification semantics; no gameplay behavior changes.
- TDD: contract tests are changed first and must fail before workflow/policy implementation.
