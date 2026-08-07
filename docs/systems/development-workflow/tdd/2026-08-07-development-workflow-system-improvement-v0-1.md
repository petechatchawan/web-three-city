# Development Workflow System Improvement v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Development Workflow System Improvement v0.1 so AI and human development uses fast package-targeted feedback by default, staged-file auto-fixes prevent formatter churn, repository workflow policy is explicit, and final safety gates remain unchanged.

**Architecture:** This milestone changes repository-development infrastructure only. Root/package manifests expose fast-loop commands, Husky + lint-staged provide a staged-file guard, root `AGENTS.md` becomes the normative AI workflow authority, GitHub templates consume that authority, and living documentation is synchronized in the same implementation PR. Gameplay/runtime architecture, Save contracts, browser semantics, and `game-bootstrap.ts` are untouched.

**Tech Stack:** Node.js 22, pnpm 10.13.1 workspaces, Vitest 4, TypeScript 6, ESLint 9, Prettier 3, Husky, lint-staged, GitHub Issue Forms, GitHub pull-request templates, Node built-in `node:test` for repository workflow contract tests.

## Execution Status

- Tasks 1–6: implemented on `chore/development-workflow-system-improvement-v0-1` through PR #35.
- Task 7: exact-head Level 3/4 verification and merge closure remain pending.
- Required living documentation is complete before the final exact-head candidate; post-run CI metadata belongs in PR #35 rather than a metadata-only tree mutation.
- The approved task definitions below are preserved as the execution record; this status annotation does not rewrite their historical RED/GREEN instructions.

## Global Constraints

- Planning authority is `docs/systems/development-workflow/specs/2026-08-07-development-workflow-system-improvement-v0-1.md`.
- Planning PR #34 remains documentation-only. Merge it before starting implementation; create one short-lived implementation branch from the resulting `master`.
- Deliver v0.1 through **one implementation PR**. Required living docs, workflow config, tests, templates, and verification record belong in that PR; do not create routine post-merge normalization PRs.
- The default AI inner loop is Level 0 or Level 1. Do **not** run `pnpm verify` after every localized edit.
- Level 1 is owning-package `test` + `typecheck`.
- Public/exported contract changes require at least Level 2 according to `AGENTS.md § Verification Escalation Rules`.
- Root/workspace/tooling configuration changes require Level 3 before PR finalization.
- Milestone closure requires Level 4 once, on the exact final candidate head.
- Highest required verification level wins as the **final gate**; lower levels remain the preferred implementation feedback loop.
- Uncertainty does not justify jumping directly to Level 4. Inspect the registry/manifests and escalate one level at a time.
- The Level 2 downstream table is a conservative verification policy, not the architectural dependency source of truth.
- A workspace dependency relationship change must update the static Level 2 map in `AGENTS.md` in the same PR.
- Pre-commit runs staged-file Prettier + ESLint fixes only. No TypeScript, Vitest, build, `pnpm verify`, or Playwright in the hook.
- Existing `format:check`, `lint`, `typecheck`, `test`, `check`, `verify`, `verify:full`, browser commands, determinism rules, Save compatibility rules, and final CI safety semantics keep their existing meaning.
- `master` is the always-releasable trunk by repository policy. Do not restore `develop`.
- Required behavior/current-state docs must be correct **before** the final exact-head verification candidate is created.
- Do not create a new commit merely to insert final CI run IDs/artifact metadata after exact-head verification. Record such evidence in the PR body/comment when the tree does not need to change.
- No gameplay/runtime behavior changes are allowed in this milestone.
- Do not refactor `apps/game/src/game-bootstrap.ts`, add an Application Layer, Nx/Turborepo, automatic affected-graph tooling, browser sharding/tagging, or Economy.

---

## Delivery Shape

After Planning PR #34 is merged:

```text
master
  ↓
chore/development-workflow-system-improvement-v0-1
  ↓
one implementation PR → master
```

Recommended implementation commits inside that PR:

1. `build(workflow): add package fast-loop scripts`
2. `build(workflow): add staged pre-commit guard`
3. `docs(workflow): add repository agent guide`
4. `chore(github): add workflow issue and PR templates`
5. `docs(workflow): align trunk workflow and system registry`
6. `docs(workflow): finalize workflow v0.1 handoff`

The commits are review checkpoints, not separate PRs.

## File Map

### Create

- `tooling/development-workflow.test.mjs` — executable repository contract tests for workflow scripts, hook policy, `AGENTS.md`, GitHub templates, and documentation synchronization.
- `.husky/pre-commit` — fast staged-file guard entry point.
- `AGENTS.md` — normative AI onboarding, navigation, verification, branch, docs, and DoD policy.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — structured bug Issue Form.
- `.github/pull_request_template.md` — PR scope/verification/docs/DoD checklist tied back to `AGENTS.md`.
- `docs/systems/development-workflow/verification/2026-08-07-development-workflow-system-improvement-v0-1.md` — stable acceptance/closure record that does not require post-CI mutation.

### Modify

- `package.json` — `format`, `test:watch`, Husky `prepare`, lint-staged config, dev dependencies, and tooling-test registration.
- `pnpm-lock.yaml` — Husky/lint-staged resolved dependency graph.
- `apps/game/package.json` — Vitest `test:watch`.
- `packages/building-core/package.json`
- `packages/building-three/package.json`
- `packages/camera-input/package.json`
- `packages/rci-core/package.json`
- `packages/road-core/package.json`
- `packages/road-three/package.json`
- `packages/shared-testkit/package.json`
- `packages/simulation-core/package.json`
- `packages/terrain-core/package.json`
- `packages/terrain-generator/package.json`
- `packages/terrain-three/package.json`
- `packages/water-core/package.json`
- `packages/water-three/package.json`
- `packages/world-core/package.json`
- `packages/zone-core/package.json`
- `packages/zone-three/package.json`
- `docs/development-workflow.md` — replace obsolete `develop` model with trunk workflow and Verification Ladder references.
- `docs/systems/README.md` — repair RCI row and register Development Workflow.
- `docs/systems/development-workflow/README.md` — convert planning handoff into implemented current-state handoff at finalization.
- `docs/systems/development-workflow/specs/2026-08-07-development-workflow-system-improvement-v0-1.md` — mark implemented only after delivered behavior is complete; do not rewrite design history.
- `docs/systems/development-workflow/tdd/2026-08-07-development-workflow-system-improvement-v0-1.md` — mark execution complete only before exact-head candidate creation.

### Explicitly unchanged

- `apps/terrain-lab/package.json` — it currently has no Vitest `test` surface, so v0.1 must not fabricate `test:watch` there.
- Gameplay/runtime source under `apps/game/src/` and `packages/*/src/`.
- `.github/workflows/ci.yml` unless an implementation-blocking defect is independently discovered; CI redesign is out of scope.

---

### Task 1: Add Fast-Loop Contract Tests and Package Watch Scripts

**Files:**
- Create: `tooling/development-workflow.test.mjs`
- Modify: `package.json`
- Modify: `apps/game/package.json`
- Modify: all 16 `packages/*/package.json` manifests listed in the File Map

**Interfaces:**
- Consumes: existing root scripts and workspace manifests.
- Produces: root `format`, root `test:watch`, workspace `test:watch`, and an executable Node contract-test harness reused by later tasks.

- [ ] **Step 1: Create the initial failing workflow contract test**

Create `tooling/development-workflow.test.mjs` with the following initial content:

```js
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

async function readRepoText(path) {
  return readFile(new URL(path, rootUrl), 'utf8');
}

async function readRepoJson(path) {
  return JSON.parse(await readRepoText(path));
}

async function readWorkspaceManifests() {
  const manifests = [];

  for (const root of ['apps', 'packages']) {
    const rootDirectory = new URL(`${root}/`, rootUrl);
    const entries = await readdir(rootDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const path = `${root}/${entry.name}/package.json`;
      try {
        manifests.push({ path, packageJson: await readRepoJson(path) });
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }

  return manifests;
}

const rootPackageJson = await readRepoJson('package.json');

test('root exposes canonical fast-loop scripts', () => {
  assert.equal(
    rootPackageJson.scripts.format,
    'prettier --write "**/*.{ts,js,yml,yaml}"',
  );
  assert.equal(
    rootPackageJson.scripts['test:watch'],
    'pnpm -r --if-present test:watch',
  );
});

test('every Vitest workspace exposes watch mode and non-test workspaces do not get a fake test surface', async () => {
  const manifests = await readWorkspaceManifests();
  let vitestWorkspaceCount = 0;

  for (const { path, packageJson } of manifests) {
    const testScript = packageJson.scripts?.test;
    if (typeof testScript === 'string' && testScript.includes('vitest')) {
      vitestWorkspaceCount += 1;
      assert.equal(packageJson.scripts['test:watch'], 'vitest', path);
    }
  }

  assert.equal(vitestWorkspaceCount, 17);

  const terrainLab = manifests.find(
    ({ packageJson }) => packageJson.name === '@web-three-city/terrain-lab',
  );
  assert.ok(terrainLab);
  assert.equal(terrainLab.packageJson.scripts?.test, undefined);
  assert.equal(terrainLab.packageJson.scripts?.['test:watch'], undefined);
});

test('repository-wide tooling gate includes workflow contract tests', () => {
  assert.match(
    rootPackageJson.scripts['test:deployment'],
    /development-workflow\.test\.mjs/,
  );
});
```

- [ ] **Step 2: Run RED verification directly**

Run:

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: FAIL because root `format`, root/package `test:watch`, and the tooling-test registration do not exist yet.

Do **not** run `pnpm verify` here; this is a focused repository-contract RED test.

- [ ] **Step 3: Add the root fast-loop scripts**

Modify root `package.json`:

```json
{
  "scripts": {
    "format": "prettier --write \"**/*.{ts,js,yml,yaml}\"",
    "test:watch": "pnpm -r --if-present test:watch"
  }
}
```

Preserve the meaning and existing values of `format:check`, `lint`, `typecheck`, `test`, `check`, `verify`, `verify:full`, and browser scripts.

Also add `tooling/development-workflow.test.mjs` to the existing `test:deployment` Node test command so future Level 3 verification executes the workflow contract test automatically.

- [ ] **Step 4: Add `test:watch` only to existing Vitest workspaces**

In each of the following manifests, place this beside the existing `test` script:

```json
"test:watch": "vitest"
```

Required manifests:

```text
apps/game/package.json
packages/building-core/package.json
packages/building-three/package.json
packages/camera-input/package.json
packages/rci-core/package.json
packages/road-core/package.json
packages/road-three/package.json
packages/shared-testkit/package.json
packages/simulation-core/package.json
packages/terrain-core/package.json
packages/terrain-generator/package.json
packages/terrain-three/package.json
packages/water-core/package.json
packages/water-three/package.json
packages/world-core/package.json
packages/zone-core/package.json
packages/zone-three/package.json
```

Do not modify `apps/terrain-lab/package.json` because it has no existing Vitest `test` script.

- [ ] **Step 5: Run GREEN focused verification**

Run:

```bash
node --test tooling/development-workflow.test.mjs
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
```

Expected: all PASS.

Smoke the watch script without leaving an interactive watcher running:

```bash
pnpm --filter @web-three-city/rci-core test:watch -- --run
```

Expected: the RCI Vitest suite runs once and exits successfully.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json apps/game/package.json packages/*/package.json tooling/development-workflow.test.mjs
git commit -m "build(workflow): add package fast-loop scripts"
```

Do not include unrelated files.

---

### Task 2: Add Husky + lint-staged Fast Pre-Commit Guard

**Files:**
- Modify: `tooling/development-workflow.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.husky/pre-commit`

**Interfaces:**
- Consumes: root Prettier/ESLint executables.
- Produces: staged-file format/lint guard only; no slow verification side effects.

- [ ] **Step 1: Extend the contract test with failing pre-commit requirements**

Append:

```js
test('pre-commit setup is staged-only and excludes slow gates', async () => {
  const packageJson = await readRepoJson('package.json');
  const preCommit = await readRepoText('.husky/pre-commit');

  assert.equal(packageJson.scripts.prepare, 'husky');
  assert.equal(typeof packageJson.devDependencies.husky, 'string');
  assert.equal(typeof packageJson.devDependencies['lint-staged'], 'string');
  assert.equal(preCommit.trim(), 'pnpm exec lint-staged');

  const lintStaged = packageJson['lint-staged'];
  assert.deepEqual(lintStaged['*.{ts,js}'], [
    'prettier --write',
    'eslint --fix',
  ]);
  assert.equal(lintStaged['*.{mjs,cjs}'], 'eslint --fix');
  assert.equal(lintStaged['*.{yml,yaml}'], 'prettier --write');

  const serializedPolicy = `${preCommit}\n${JSON.stringify(lintStaged)}`;
  assert.doesNotMatch(
    serializedPolicy,
    /typecheck|vitest|playwright|pnpm verify|eslint \.|pnpm lint/i,
  );
});
```

- [ ] **Step 2: Run RED verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: the new pre-commit test FAILS because Husky/lint-staged/config/hook are absent.

- [ ] **Step 3: Install the two root development dependencies**

Run from repository root:

```bash
pnpm add -Dw husky lint-staged
```

Expected: root `package.json` and `pnpm-lock.yaml` update; no workspace runtime dependency changes.

Do not hand-edit resolved versions into `pnpm-lock.yaml`.

- [ ] **Step 4: Configure root lifecycle and lint-staged**

Add:

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,js}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{mjs,cjs}": "eslint --fix",
    "*.{yml,yaml}": "prettier --write"
  }
}
```

This deliberately does not run Prettier on file types outside the repository's current `format:check` policy.

- [ ] **Step 5: Create the hook with executable mode**

Create `.husky/pre-commit` exactly as:

```sh
pnpm exec lint-staged
```

Then:

```bash
chmod +x .husky/pre-commit
git update-index --add --chmod=+x .husky/pre-commit
```

Do not use `husky init` if it would inject `npm test` or another slow command into the hook.

- [ ] **Step 6: Run GREEN contract verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Smoke the actual staged-file behavior**

Create a disposable staged TypeScript file:

```bash
cat > tooling/.workflow-hook-smoke.ts <<'EOF'
export const workflowHookSmoke={ok:true}
EOF
git add tooling/.workflow-hook-smoke.ts
pnpm exec lint-staged
cat tooling/.workflow-hook-smoke.ts
```

Expected formatted content:

```ts
export const workflowHookSmoke = { ok: true };
```

Clean the disposable fixture completely:

```bash
git restore --staged tooling/.workflow-hook-smoke.ts
rm tooling/.workflow-hook-smoke.ts
git status --short
```

Expected: no `.workflow-hook-smoke.ts` remains staged or untracked.

- [ ] **Step 8: Verify installation lifecycle once**

```bash
pnpm install
```

Expected: `prepare` executes without introducing tracked changes beyond the intended manifest/lockfile/hook changes.

- [ ] **Step 9: Commit Task 2**

```bash
git add package.json pnpm-lock.yaml .husky/pre-commit tooling/development-workflow.test.mjs
git commit -m "build(workflow): add staged pre-commit guard"
```

The newly introduced hook should run on this commit; it must remain fast and must not launch TypeScript/tests/browser verification.

---

### Task 3: Add Root AGENTS.md as the Normative AI Workflow Authority

**Files:**
- Modify: `tooling/development-workflow.test.mjs`
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: system registry, workspace package names, approved Verification Ladder and static map.
- Produces: one root onboarding/policy file used by AI before editing and by the PR template for escalation authority.

- [ ] **Step 1: Add failing AGENTS contract tests**

Append:

```js
test('AGENTS defines actionable repository navigation and verification policy', async () => {
  const agents = await readRepoText('AGENTS.md');

  for (const heading of [
    '## Repository Map',
    '## How to Locate Code',
    '## Architecture Rules',
    '## Fast Verification',
    '## Verification Escalation Rules',
    '## Static Level 2 Verification Map',
    '## Branch Policy',
    '## Documentation and Exact-Head Evidence',
    '## Definition of Done',
    '## Forbidden Shortcuts',
  ]) {
    assert.match(agents, new RegExp(heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }

  assert.match(agents, /pnpm --filter @web-three-city\/<pkg> test/);
  assert.match(agents, /pnpm --filter @web-three-city\/<pkg> typecheck/);
  assert.match(agents, /Level 0/);
  assert.match(agents, /Level 1/);
  assert.match(agents, /Level 2/);
  assert.match(agents, /Level 3/);
  assert.match(agents, /Level 4/);
  assert.match(agents, /highest required level/i);
  assert.match(agents, /conservative verification map/i);
  assert.match(agents, /same PR/i);
  assert.match(agents, /exact-head/i);
  assert.match(agents, /do not.*pnpm verify.*every|pnpm verify.*not.*default/is);
  assert.match(agents, /master.*always-releasable/is);
});

test('AGENTS static Level 2 map contains every approved changed-owner row', async () => {
  const agents = await readRepoText('AGENTS.md');
  for (const owner of [
    'world-core',
    'terrain-core',
    'simulation-core',
    'zone-core',
    'building-core',
    'rci-core',
    'road-core',
    'water-core',
    'terrain-generator',
    'camera-input',
    'building-three',
    'road-three',
    'terrain-three',
    'water-three',
    'zone-three',
  ]) {
    assert.match(agents, new RegExp(`\\| \\`${owner}\\` \\|`));
  }
});

test('AGENTS makes the exact-head documentation exception normative', async () => {
  const agents = await readRepoText('AGENTS.md');
  assert.match(agents, /living.*documentation.*before.*exact-head/is);
  assert.match(agents, /PR body|PR comment|pull request body|pull request comment/i);
  assert.match(agents, /do not create.*commit.*run ID|do not.*commit.*CI.*metadata/is);
});
```

If the heading-regex helper proves unnecessarily brittle while implementing, replace it with `agents.includes(heading)` assertions rather than weakening the required headings.

- [ ] **Step 2: Run RED verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: FAIL because root `AGENTS.md` does not exist.

- [ ] **Step 3: Create AGENTS.md with these mandatory sections**

Use this structure and keep it concise enough for fast AI onboarding:

```text
# Repository Agent Guide

## Repository Map
## How to Locate Code
## Architecture Rules
## Fast Verification
## Verification Escalation Rules
## Static Level 2 Verification Map
## Branch Policy
## Documentation and Exact-Head Evidence
## Definition of Done
## Forbidden Shortcuts
```

`## Repository Map` must explain:

```text
apps/                    runnable composition/UI/labs
packages/*-core          deterministic domain/foundation authority
packages/*-three         Three.js presentation adapters
packages/camera-input    camera/input adapter utility
packages/shared-testkit  shared test-only helpers
packages/terrain-generator terrain generation domain utility
tooling/                 repository verification/deployment tooling
docs/systems/            living system registry/spec/ADR/TDD/verification
browser-tests/           browser acceptance/release evidence
```

`## How to Locate Code` must define:

```text
symptom/request
→ docs/systems/README.md
→ owning docs/systems/<system>/README.md
→ owning package/app
→ colocated tests
→ implementation
```

`## Architecture Rules` must state at minimum:

- `*-core` is deterministic and must not depend on DOM or Three.js presentation.
- `*-three` is presentation/adapter code and consumes domain snapshots/contracts rather than owning gameplay state.
- `apps/game` composes systems; cross-system orchestration does not justify circular core-package imports.
- state authority, Save compatibility, deterministic ordering, and atomic commit behavior must not be weakened by workflow changes.

`## Fast Verification` must show the canonical commands:

```bash
pnpm --filter @web-three-city/<pkg> test:watch
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
pnpm format
pnpm verify
pnpm verify:full
pnpm test:browser
```

Explain explicitly that `pnpm verify` is Level 3, **not** the default after each local edit.

`## Verification Escalation Rules` must copy the approved Level 0–4 semantics and conflict-resolution rules from the specification. The PR template will link here, so do not paraphrase away normative details such as:

- highest required level wins;
- public/exported contract ≥ Level 2;
- root/workspace/tooling config = Level 3;
- browser acceptance/milestone closure = Level 4;
- Save compatibility owner + game at minimum Level 2;
- dependency relation change updates this file's static map in the same PR;
- uncertainty escalates one level, then inspect registry/manifests; it does not jump directly to full verification.

`## Static Level 2 Verification Map` must reproduce the approved conservative map from the specification. Before committing, compare the table against current workspace manifests. If a concrete direct consumer is found missing, fix the specification and `AGENTS.md` together in the implementation PR; that is a factual synchronization correction, not permission to redesign the map policy.

`## Branch Policy` must say:

```text
master = always-releasable trunk by policy
short-lived feat/*, fix/*, docs/*, chore/* → PR → master
release boundary = Git tag / accepted master commit
no develop integration branch
```

Do not claim GitHub branch protection is technically enabled unless repository settings actually enforce it; describe the policy, not a nonexistent setting.

`## Documentation and Exact-Head Evidence` must contain the approved same-PR rule and exact-head CI metadata exception **before** any final-verification instructions.

`## Definition of Done` must require scope correctness, targeted verification, required consumers per this file, docs synchronization, determinism/Save handling where applicable, no debug residue, final gate evidence, and exact candidate SHA when final verification is required.

`## Forbidden Shortcuts` must include:

- no default whole-repo verification after every small edit;
- no skipping Level 2 for observable public-contract changes;
- no inventing downstream consumers from memory when the table/manifests exist;
- no knowingly stale living docs at merge;
- no formatter-only cleanup PR as the normal path;
- no runtime/domain behavior in `*-three` or workflow docs/config.

- [ ] **Step 4: Run GREEN contract verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add AGENTS.md tooling/development-workflow.test.mjs
git commit -m "docs(workflow): add repository agent guide"
```

---

### Task 4: Add GitHub Bug Issue Form and Pull Request DoD Template

**Files:**
- Modify: `tooling/development-workflow.test.mjs`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: system registry vocabulary and `AGENTS.md § Verification Escalation Rules`.
- Produces: structured bug intake and PR checklist; neither file redefines verification authority.

- [ ] **Step 1: Add failing template contract tests**

Append:

```js
test('bug Issue Form captures system, symptom, expectation, actual behavior, and reproduction', async () => {
  const issueForm = await readRepoText('.github/ISSUE_TEMPLATE/bug_report.yml');

  assert.match(issueForm, /name:\s*Bug report/i);
  assert.match(issueForm, /type:\s*dropdown/);
  assert.match(issueForm, /id:\s*system/);
  for (const system of [
    'World',
    'Terrain',
    'Water',
    'Roads',
    'Zoning',
    'Buildings',
    'Simulation Time',
    'RCI Demand & Occupancy',
    'Economy',
    'Cross-system / Unknown',
  ]) {
    assert.match(issueForm, new RegExp(system.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
  }

  for (const id of ['symptom', 'expected', 'actual', 'reproduction']) {
    assert.match(issueForm, new RegExp(`id:\\s*${id}`));
  }
  assert.match(issueForm, /required:\s*true/);
});

test('PR template delegates affected-consumer decisions to AGENTS and enforces same-PR docs', async () => {
  const template = await readRepoText('.github/pull_request_template.md');

  assert.match(template, /AGENTS\.md.*Verification Escalation Rules/is);
  assert.match(template, /Targeted package tests/i);
  assert.match(template, /Targeted package typecheck/i);
  assert.match(template, /Affected consumer verification/i);
  assert.match(template, /docs\/systems\/<system>\/README\.md/i);
  assert.match(template, /Behavior.*contracts.*unchanged|documentation update not required/is);
  assert.match(template, /exact.*SHA/i);
  assert.match(template, /debug|temporary/i);
});
```

- [ ] **Step 2: Run RED verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: FAIL because the Issue Form and PR template do not exist.

- [ ] **Step 3: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

Use a valid GitHub Issue Form with required fields:

```yaml
name: Bug report
description: Report a reproducible game or system defect
title: "[Bug]: "
body:
  - type: dropdown
    id: system
    attributes:
      label: System
      description: Choose the owning system when known.
      options:
        - World
        - Terrain
        - Water
        - Roads
        - Zoning
        - Buildings
        - Simulation Time
        - RCI Demand & Occupancy
        - Economy
        - Cross-system / Unknown
    validations:
      required: true

  - type: textarea
    id: symptom
    attributes:
      label: Symptom
      description: What did you observe?
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction steps
      description: Include the smallest repeatable sequence.
    validations:
      required: true

  - type: textarea
    id: state
    attributes:
      label: Save, game time, and environment
      description: Include save version/state, in-game date/time, browser, Node/pnpm, or other relevant context.

  - type: textarea
    id: evidence
    attributes:
      label: Screenshots, console output, or evidence
```

Do not create a Markdown bug template in parallel; the YAML form is the authority.

- [ ] **Step 4: Create `.github/pull_request_template.md`**

The template must include these sections:

```markdown
## Scope

- System:
- Owning package(s):
- Behavior/contract changed:

## Verification

- [ ] Targeted package tests passed.
- [ ] Targeted package typecheck passed.
- [ ] Affected consumer verification required by [AGENTS.md § Verification Escalation Rules](../AGENTS.md#verification-escalation-rules) passed.
- [ ] Relevant browser verification passed when the escalation rules require it.
- [ ] Final repository/CI evidence is recorded for the required level.

Commands/results:

## Documentation

- [ ] `docs/systems/<system>/README.md` is updated in this PR; or
- [ ] Behavior/contracts/ownership/Save/dependency boundaries are unchanged, so a living-doc update is not required.

## Definition of Done

- [ ] No unrelated changes.
- [ ] No temporary/debug artifacts.
- [ ] Determinism and Save compatibility are addressed when applicable.
- [ ] Exact candidate SHA is recorded when final exact-head verification is required.
```

The wording may be polished, but the affected-consumer checkbox must explicitly link to `AGENTS.md § Verification Escalation Rules`; do not duplicate a second escalation table in the template.

- [ ] **Step 5: Run GREEN verification**

```bash
node --test tooling/development-workflow.test.mjs
pnpm exec prettier --check .github/ISSUE_TEMPLATE/bug_report.yml
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add .github/ISSUE_TEMPLATE/bug_report.yml .github/pull_request_template.md tooling/development-workflow.test.mjs
git commit -m "chore(github): add workflow issue and PR templates"
```

---

### Task 5: Replace Obsolete `develop` Workflow and Repair the System Registry

**Files:**
- Modify: `tooling/development-workflow.test.mjs`
- Modify: `docs/development-workflow.md`
- Modify: `docs/systems/README.md`

**Interfaces:**
- Consumes: `AGENTS.md` branch/verification policy and authoritative RCI README.
- Produces: consistent human-facing workflow documentation and registry state.

- [ ] **Step 1: Add failing documentation synchronization tests**

Append:

```js
test('development workflow documents master trunk and package-targeted iteration instead of develop integration', async () => {
  const workflow = await readRepoText('docs/development-workflow.md');

  assert.match(workflow, /master.*always-releasable.*trunk/is);
  assert.match(workflow, /short-lived.*branch.*pull request.*master/is);
  assert.match(workflow, /Verification Ladder/i);
  assert.match(workflow, /AGENTS\.md/);
  assert.match(workflow, /pnpm --filter @web-three-city\/<pkg> test/);
  assert.doesNotMatch(workflow, /develop is the active integration branch/i);
  assert.doesNotMatch(workflow, /target `develop`/i);
});

test('system registry reports implemented RCI and the Development Workflow system', async () => {
  const registry = await readRepoText('docs/systems/README.md');

  assert.match(
    registry,
    /\[RCI Demand & Occupancy\]\(rci\/README\.md\).*Implemented.*`rci-core`.*`RciSaveV1`.*`WorldSaveV5`/i,
  );
  assert.match(
    registry,
    /\[Development Workflow\]\(development-workflow\/README\.md\).*Implemented/i,
  );
});
```

- [ ] **Step 2: Run RED verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: FAIL because `docs/development-workflow.md` still defines `develop` as integration and the registry still reports RCI as unimplemented / lacks implemented Development Workflow status.

- [ ] **Step 3: Rewrite `docs/development-workflow.md` around the actual trunk policy**

Keep useful deployment/final-verification information, but replace branch roles and normal flow with:

```text
short-lived feat/* | fix/* | docs/* | chore/*
                  ↓ pull request
master — always-releasable trunk
                  ↓ accepted production commit/tag
Vercel Production (master Git integration)
```

Required rules:

- do not restore or require `develop`;
- implementation occurs on short-lived branches and targets `master` by PR;
- during implementation, use `AGENTS.md` Level 0–2 and package-targeted commands;
- `pnpm verify` is Level 3 PR finalization, not the edit loop;
- `pnpm verify:full` is Level 4 release/milestone closure when required;
- exact-head evidence remains required for Level 4;
- Vercel Production Branch remains `master`;
- GitHub branch-protection wording must distinguish policy from actual repository setting.

Show the canonical inner-loop pattern:

```bash
pnpm --filter @web-three-city/<pkg> test
pnpm --filter @web-three-city/<pkg> typecheck
```

- [ ] **Step 4: Repair `docs/systems/README.md` RCI status from authoritative current state**

Change the stale RCI row to communicate:

```text
RCI Demand & Occupancy | Implemented | rci-core + apps/game orchestration | RciSaveV1 / WorldSaveV5
```

Do not duplicate the full RCI behavior specification; the row is an index into `docs/systems/rci/README.md`.

- [ ] **Step 5: Register Development Workflow**

Add a registry row linking `development-workflow/README.md` with status `Implemented`, ownership around root configuration / `.github/` / `AGENTS.md` / development docs, and Git-tracked configuration/documentation persistence.

This row becomes valid only because the implementation PR now contains the actual workflow behavior; do not mark it implemented before Tasks 1–4 are green.

- [ ] **Step 6: Run GREEN verification**

```bash
node --test tooling/development-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add docs/development-workflow.md docs/systems/README.md tooling/development-workflow.test.mjs
git commit -m "docs(workflow): align trunk workflow and system registry"
```

---

### Task 6: Finalize the Living Handoff and Stable Verification Record Before Exact-Head Testing

**Files:**
- Modify: `docs/systems/development-workflow/README.md`
- Modify: `docs/systems/development-workflow/specs/2026-08-07-development-workflow-system-improvement-v0-1.md`
- Modify: `docs/systems/development-workflow/tdd/2026-08-07-development-workflow-system-improvement-v0-1.md`
- Create: `docs/systems/development-workflow/verification/2026-08-07-development-workflow-system-improvement-v0-1.md`

**Interfaces:**
- Consumes: all delivered Tasks 1–5.
- Produces: living current-state docs that are already correct before the exact final candidate SHA is verified.

- [ ] **Step 1: Convert the workflow system README from planning state to current-state handoff**

Set status to `Implemented` and document concisely:

- package-targeted Level 0/1 default loop;
- Level 0–4 escalation and `AGENTS.md` authority;
- static downstream map maintenance rule;
- root `format` and package `test:watch` scripts;
- staged-only Husky/lint-staged hook;
- Issue Form + PR template;
- trunk/master policy;
- same-PR living-doc rule;
- exact-head evidence exception;
- current limitations deferred to v0.2 (`game-bootstrap` refactor, affected graph, browser sharding, Nx/Turbo).

Link to the approved spec, this TDD plan, `AGENTS.md`, and the verification record.

- [ ] **Step 2: Mark the design specification delivered without rewriting historical decisions**

Change only status/current-delivery annotations needed to indicate the approved v0.1 design has been implemented. Preserve the approved decisions, goals, non-goals, and historical rationale.

If Task 3 discovered a concrete manifest mismatch in the static map, synchronize only that factual table content and note that it was reconciled against current workspace manifests during implementation; do not broaden scope.

- [ ] **Step 3: Create the stable verification record before final exact-head verification**

Create:

```markdown
# Development Workflow System Improvement v0.1 — Verification

**Status:** Final candidate ready for exact-head verification
**System:** development-workflow
**Date:** 2026-08-07

## Delivered Contracts

- package-targeted inner loop and Vitest watch scripts
- staged-only Prettier/ESLint pre-commit guard
- normative root AGENTS.md with Level 0–4 escalation and static Level 2 map
- GitHub bug Issue Form and PR DoD template
- master trunk workflow and repaired system registry
- same-PR living documentation / exact-head CI evidence policy

## Pre-Candidate Verification

Record the deterministic command names and pass/fail result available before the final candidate commit. Do not insert future CI run IDs or artifact IDs here.

## Exact-Head Evidence Policy

Final SHA, CI run IDs, artifact IDs, and post-run counts are recorded in the implementation PR body/comment after the candidate is verified. They are not committed solely to mutate this record after verification.

## Acceptance

- workflow contract test passes
- pre-commit staged-file smoke passes with no residue
- package-targeted smoke passes
- Level 3 pnpm verify passes
- Level 4 pnpm verify:full passes on the exact clean candidate head
- no gameplay/runtime source changed
```

Replace explanatory placeholders such as “Record ...” with the actual pre-candidate command/results before committing this file. The only information intentionally deferred is post-run exact-head metadata covered by policy.

- [ ] **Step 4: Mark this TDD plan execution complete**

Check all completed task boxes or add an execution-status section indicating Tasks 1–6 are implemented and only exact-head Level 3/4 candidate verification remains. Do this **before** creating the final candidate commit so no TDD-status-only commit is needed afterward.

- [ ] **Step 5: Run focused documentation/tooling checks**

```bash
node --test tooling/development-workflow.test.mjs tooling/verification-scripts.test.mjs
pnpm exec prettier --check "**/*.{ts,js,yml,yaml}"
```

Expected: PASS.

- [ ] **Step 6: Confirm the milestone stayed out of runtime scope**

Review the changed-file list:

```bash
git diff --name-only master...HEAD
```

Expected: only root manifests/config, `.husky`, `.github`, `AGENTS.md`, `tooling/development-workflow.test.mjs`, package manifests, lockfile, and workflow/system documentation. There must be no gameplay/runtime source change under `apps/game/src/` or `packages/*/src/`.

- [ ] **Step 7: Commit the completed handoff**

```bash
git add docs/systems/development-workflow
git commit -m "docs(workflow): finalize workflow v0.1 handoff"
```

After this commit, required living documentation must already be correct. Any subsequent fix that changes the tree invalidates the candidate and requires verification again.

---

### Task 7: Run the Final Verification Ladder Once and Prepare the Implementation PR for Merge

**Files:**
- No planned tree changes after the final candidate commit.
- PR body/comment receives exact-head evidence; repository files do not change solely for CI metadata.

**Interfaces:**
- Consumes: completed implementation tree.
- Produces: accepted exact-head verification evidence for merge.

- [ ] **Step 1: Run the workflow contract test first**

```bash
node --test tooling/development-workflow.test.mjs tooling/verification-scripts.test.mjs
```

Expected: PASS.

This is the fastest failure surface for workflow-policy/config mistakes.

- [ ] **Step 2: Run representative Level 1 package checks**

Because package manifests changed but runtime source did not, verify at least representative core + app surfaces before repository-wide gates:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

Expected: PASS.

Do not run all packages manually one-by-one here; Level 3 covers the whole workspace once.

- [ ] **Step 3: Run Level 3 repository finalization**

```bash
pnpm verify
```

Expected: PASS for formatting, ESLint, workspace/browser TypeScript, provenance, workspace tests, deployment/tooling tests (including `development-workflow.test.mjs`), and builds.

If this fails, fix the root cause using the smallest targeted test, update docs if the contract changed, create a new commit, and restart final-candidate verification. Do not stack formatter-only correction commits if `pnpm format`/pre-commit can fix the issue before commit.

- [ ] **Step 4: Establish the exact clean candidate SHA**

```bash
git status --short
git rev-parse HEAD
```

Expected:

- `git status --short` prints nothing;
- record the exact SHA in the implementation PR body before Level 4.

- [ ] **Step 5: Run Level 4 milestone closure on that exact head**

```bash
pnpm verify:full
```

Expected: PASS, including frozen install, Level 3 verification, Chromium availability, full Playwright browser suite, and clean-worktree verification.

This is intentionally the one expensive full-browser run for milestone closure, not an inner-loop command.

- [ ] **Step 6: Record exact-head evidence without mutating the tree**

Update the implementation PR body or add one PR comment containing:

```text
Exact candidate SHA: <sha>
Node: <version>
pnpm: <version>
Workflow contract tests: PASS
Level 1 representative checks: PASS
Level 3 pnpm verify: PASS
Level 4 pnpm verify:full: PASS
Playwright: <actual final count>
Clean worktree: PASS
Known limitations: v0.2 items only / none introduced by v0.1
```

If CI provides run IDs/artifact IDs, record them in the same PR evidence instead of creating a docs-only commit.

- [ ] **Step 7: Final DoD review against the new PR template**

Confirm:

- scope/system/owners are identified;
- targeted tests + typechecks are recorded;
- affected-consumer requirement was resolved using `AGENTS.md`, not memory;
- living docs are current in the same PR;
- no runtime/gameplay source changed;
- no debug fixture or staged residue exists;
- exact SHA evidence matches the current head;
- no commit was created after successful Level 4 verification.

- [ ] **Step 8: Merge by repository-standard squash only after exact-head evidence is accepted**

Use an expected-head guard against the verified implementation SHA. After merge, confirm the merged tree matches the verified candidate tree. Do not create a routine documentation-closure PR; the v0.1 documentation is already complete by design.

---

## TDD / Verification Matrix

| Requirement | RED proof | GREEN inner loop | Final level |
|---|---|---|---|
| root `format` | workflow contract test | `node --test tooling/development-workflow.test.mjs` | L3 |
| package `test:watch` | dynamic manifest assertion | workflow contract + representative watch smoke | L3 |
| Husky/lint-staged | missing config/hook test | workflow contract + disposable staged-file smoke | L3 |
| no slow pre-commit gates | negative regex contract | workflow contract | L3 |
| root `AGENTS.md` | missing-file/heading/policy assertions | workflow contract | L3 |
| static Level 2 map | owner-row assertions + manifest review | workflow contract | L3 |
| exact-head docs exception | AGENTS policy assertion | workflow contract | L3/L4 |
| bug Issue Form | missing YAML/required field assertions | Node contract + Prettier YAML check | L3 |
| PR template → AGENTS authority | missing/reference assertion | Node contract | L3 |
| trunk workflow | stale `develop` assertion | Node contract | L3 |
| RCI registry repair | stale row assertion | Node contract | L3 |
| Development Workflow registry | missing row assertion | Node contract | L3 |
| no runtime behavior change | changed-file scope review | `git diff --name-only` | L3/L4 |
| milestone closure | N/A until candidate exists | lower levels first | L4 exact head |

## Static Map Review Checklist During Implementation

Before committing `AGENTS.md`, inspect current workspace manifests rather than trusting memory. At minimum verify these currently observed relationships remain represented conservatively by the approved policy:

```text
world-core → terrain-core / road-core / water-core / zone-core / building-core / rci-core / adapters/apps
terrain-core → road-core / water-core / zone-core / building-core / adapters/apps
simulation-core → building-core / rci-core / game
zone-core → building-core / rci-core / zone-three / game
building-core → rci-core / building-three / game
rci-core → game
road-core → road-three / game / terrain-lab
water-core → water-three / game / terrain-lab
terrain-generator → game / terrain-lab
camera-input → game / terrain-lab
*-three → consuming app(s)
```

`shared-testkit` is test-only infrastructure. If manifest review shows a changed public testkit contract has consumers that need Level 2 verification, document that explicitly in `AGENTS.md` rather than pretending it is a gameplay owner. Do not turn this review into automatic graph tooling in v0.1.

## Plan Self-Review

### Spec coverage

- Fast package-targeted loop: Tasks 1 and 7.
- Root formatter auto-fix: Task 1.
- Vitest watch scripts only where a Vitest test surface exists: Task 1.
- Husky/lint-staged staged-only guard: Task 2.
- No typecheck/tests in pre-commit: Task 2 contract + smoke.
- Single root `AGENTS.md`: Task 3.
- Level 0–4 and conflict resolution: Task 3.
- Static downstream map + same-PR dependency-map maintenance: Task 3.
- PR template explicitly defers to AGENTS escalation authority: Task 4.
- YAML Issue Form required fields/system dropdown: Task 4.
- `master` trunk / no `develop`: Task 5.
- RCI registry correction: Task 5.
- Development Workflow registry/living docs: Tasks 5–6.
- Same-PR docs rule and exact-head evidence exception: Tasks 3, 4, 6, 7.
- Full safety gates preserved and full browser run occurs only at milestone closure: Task 7.
- Out-of-scope runtime refactor/gameplay work: Global Constraints + Task 6 scope check.

### Placeholder scan

The implementation steps contain no `TBD`, `TODO`, “implement later”, or undefined future behavior. Post-run CI identifiers are intentionally excluded from committed docs by approved exact-head policy and are recorded in the PR after verification.

### Type/command consistency

- Package fast-loop command is consistently `pnpm --filter @web-three-city/<pkg> test|typecheck|test:watch`.
- Root final commands remain `pnpm verify` and `pnpm verify:full`.
- Workflow contract test path is consistently `tooling/development-workflow.test.mjs` and is wired into `test:deployment` so existing `pnpm check` executes it.
- GitHub bug form path is consistently `.github/ISSUE_TEMPLATE/bug_report.yml`.
- PR template authority consistently points to `AGENTS.md § Verification Escalation Rules`.
- Planning remains in PR #34; implementation is one subsequent PR after planning merge.

## Completion Definition

Development Workflow System Improvement v0.1 is complete only when:

1. Planning PR #34 (spec + this TDD plan) is merged.
2. One implementation PR delivers Tasks 1–6 with no gameplay/runtime source change.
3. Task 7 Level 3 and Level 4 exact-head verification pass.
4. Required living docs are already correct on the verified head.
5. Exact-head evidence is recorded in the implementation PR without a metadata-only tree mutation.
6. The verified implementation is squash-merged to `master` and the merged tree is checked against the verified candidate tree.
7. No routine post-merge documentation normalization PR is required.
