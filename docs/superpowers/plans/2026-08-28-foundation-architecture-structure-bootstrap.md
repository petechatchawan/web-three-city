# Foundation Architecture & Structure Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete clean-slate Foundation + Architecture + Structure scaffold defined by frozen A3–A12 without introducing gameplay systems or deferred runtime/persistence/ECS behavior.

**Architecture:** Build a pnpm/TypeScript monorepo with three concrete bootstrap packages only: `apps/game`, `foundation/contracts`, and `tooling/architecture`. The architecture checker derives workspace/package/import facts from the repository, enforces A3–A11 mechanically where observable, and is verified through synthetic valid/invalid fixtures. The browser app proves executable composition and Three.js presentation boundaries without gameplay state.

**Tech Stack:** Node.js 22.18.0, pnpm 10.15.1, TypeScript 5.9.2, Vitest 3.2.4, Vite 7.1.3, Three.js 0.179.1, ESLint 9.34.0, typescript-eslint 8.40.0, Prettier 3.6.2, Playwright 1.55.0, Husky 9.1.7, YAML 2.8.1, GitHub Actions.

**Spec:** `docs/architecture/FOUNDATION-BOOTSTRAP-STRUCTURE.md` together with frozen A3–A11 documents in `docs/architecture/`.

## Global Constraints

- No gameplay packages under `systems/*` are created.
- No speculative `orchestration/*`, `testkit/*`, `foundation/runtime`, `foundation/deterministic`, `foundation/event-bus`, `foundation/persistence`, or `foundation/spatial` packages are created.
- Repository root remains workspace/control-plane only.
- `package.json` `exports` is the cross-package visibility authority.
- Cross-package deep imports and relative reach-through are forbidden.
- Production system-to-system mutation remains forbidden; only reviewed root-read edges may exist and must remain acyclic.
- Repository-level tests may use deliberately exported public command/composition surfaces; `testkit/*` gets no such privilege.
- Three.js remains in app/presentation code only.
- Architecture tooling derives facts from current workspace/manifests/imports and a narrow exception policy; no manual full dependency graph.
- Architecture checker diagnostics are deterministic and machine-readable.
- TDD applies to executable behavior. Configuration-only files are scaffolded directly because they are declarative infrastructure rather than production behavior.
- No pre-reset implementation/spec/test/tooling is consulted or copied.

---

### Task 1: Workspace control plane and exact toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.prettierignore`
- Create: `architecture.policy.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: frozen A3/A4/A8/A12 package naming and creation rules.
- Produces: root commands `format:check`, `lint`, `typecheck`, `test`, `architecture:check`, `build`, `test:browser`, `verify`; workspace patterns for approved namespaces only; narrow exception-policy schema version 1.

- [ ] **Step 1:** Add root `package.json` with exact versions and scripts.
- [ ] **Step 2:** Add workspace and TypeScript baseline config.
- [ ] **Step 3:** Add ESLint/Prettier config and ignored generated paths.
- [ ] **Step 4:** Add `architecture.policy.json` containing empty approved exception sets, not a dependency graph.
- [ ] **Step 5:** Update `.gitignore` for Vite cache, architecture temporary output, and generated build/test artifacts.
- [ ] **Step 6:** Commit the control-plane scaffold.

### Task 2: Architecture checker core — RED

**Files:**
- Create: `tooling/architecture/package.json`
- Create: `tooling/architecture/tsconfig.json`
- Create: `tooling/architecture/src/model.ts`
- Create: `tooling/architecture/src/index.ts`
- Create: `tooling/architecture/tests/check-architecture.test.ts`
- Create: `tooling/architecture/tests/fixture-loader.ts`
- Create: `tooling/architecture/fixtures/valid/cases.json`
- Create: `tooling/architecture/fixtures/invalid/cases.json`

**Interfaces:**
- Produces: `checkArchitecture(root: string): Promise<ArchitectureReport>`; `ArchitectureReport` contains sorted `packages`, `edges`, `violations`; fixtures materialize synthetic workspaces in temporary directories.

- [ ] **Step 1: Write failing fixture-driven tests** covering package discovery, naming, deep import, undeclared dependency, approved/unapproved system reads, command/composition permissions, query cycle, Foundation upward dependency, repository-test public command/composition access, testkit privilege rejection, contract-port leak, and domain technology/internal-layer violations.
- [ ] **Step 2: Verify RED** by running `pnpm --filter @web-three-city/tooling-architecture test`; expected failure is missing `checkArchitecture` implementation/rules, not fixture syntax errors.
- [ ] **Step 3:** Commit the RED tests and fixture contract.

### Task 3: Architecture checker discovery + import graph — GREEN

**Files:**
- Create: `tooling/architecture/src/discover-workspace.ts`
- Create: `tooling/architecture/src/source-analysis.ts`
- Create: `tooling/architecture/src/policy.ts`
- Modify: `tooling/architecture/src/index.ts`

**Interfaces:**
- `discoverWorkspace(root)` parses `pnpm-workspace.yaml`, finds real workspace package roots, reads package manifests, and classifies A4 profiles.
- `analyzeSources(...)` captures static imports, type-only imports, export-from declarations, and string-literal dynamic imports plus repository-level test imports.
- `loadArchitecturePolicy(root)` loads only approved deviations/edges from `architecture.policy.json`.

- [ ] **Step 1:** Implement workspace/package discovery and deterministic A4 naming calculation.
- [ ] **Step 2:** Implement TypeScript-AST import/export analysis including `import type` and string-literal `import()`.
- [ ] **Step 3:** Implement narrow policy loading and validation.
- [ ] **Step 4:** Run focused checker tests and confirm discovery/import tests move GREEN while later rule tests remain RED.
- [ ] **Step 5:** Commit discovery/import graph implementation.

### Task 4: Architecture package/export/dependency rules — GREEN

**Files:**
- Create: `tooling/architecture/src/rules/package-rules.ts`
- Create: `tooling/architecture/src/rules/import-rules.ts`
- Modify: `tooling/architecture/src/index.ts`

**Interfaces:**
- Produces deterministic rule IDs for package path/name/profile, export visibility, deep imports, manifest declaration, namespace permissions, production-vs-test permissions, and same-layer approval.

- [ ] **Step 1:** Implement path/name/profile validation and root-control-plane exclusion.
- [ ] **Step 2:** Implement `package.json exports` visibility resolution; exported means mechanically visible, not universally permitted.
- [ ] **Step 3:** Reject relative cross-package reach-through and unexported package subpaths.
- [ ] **Step 4:** Require explicit direct manifest dependency for workspace-package imports; production source may not rely on test-only classification.
- [ ] **Step 5:** Enforce A6 system surface matrix and separate repository-level test permission from production/testkit profiles.
- [ ] **Step 6:** Run focused tests and confirm these rule cases are GREEN.
- [ ] **Step 7:** Commit package/export/dependency rules.

### Task 5: Architecture graph, internal-boundary, and documentation rules — GREEN

**Files:**
- Create: `tooling/architecture/src/rules/graph-rules.ts`
- Create: `tooling/architecture/src/rules/internal-rules.ts`
- Create: `tooling/architecture/src/rules/document-rules.ts`
- Modify: `tooling/architecture/src/index.ts`

**Interfaces:**
- Graph rules derive production system root-read graph and same-layer Foundation/orchestration/testkit/tooling graphs, report deterministic cycle paths, and honor narrow approvals only.
- Internal rules reject `domain/` outward dependencies, browser globals, Three.js, and obvious public contract leaks into ports/application/composition/presentation internals.
- Documentation rules reject missing status headers and unresolved TODO/TBD/FIXME in `FROZEN` architecture prose outside fenced examples.

- [ ] **Step 1:** Implement approved system-read validation and deterministic cycle detection.
- [ ] **Step 2:** Implement Foundation/same-layer acyclicity and upward-dependency checks.
- [ ] **Step 3:** Implement domain technology/internal-layer checks including direct `window`, `document`, `navigator`, `localStorage`, and `sessionStorage` use.
- [ ] **Step 4:** Implement mechanical exported-contract leak checks for forbidden internal paths.
- [ ] **Step 5:** Implement documentation status/placeholder checks without treating fenced policy examples as unresolved placeholders.
- [ ] **Step 6:** Run all architecture checker tests; expected all fixture assertions GREEN.
- [ ] **Step 7:** Commit graph/internal/document rules.

### Task 6: Architecture CLI and structured diagnostics

**Files:**
- Create: `tooling/architecture/src/cli.ts`
- Modify: `tooling/architecture/package.json`
- Modify: `tooling/architecture/tests/check-architecture.test.ts`

**Interfaces:**
- CLI: `tsx src/cli.ts --root <repo> [--json]` exits 0 with no violations and 1 with violations.
- Human output includes stable rule ID, source, target when relevant, reason, and binding reference.
- JSON output returns sorted package/edge/violation arrays.

- [ ] **Step 1: RED:** Add CLI-format/exit-code tests around a pure `formatReport()`/`exitCodeForReport()` interface.
- [ ] **Step 2:** Run tests and verify expected RED failures.
- [ ] **Step 3: GREEN:** Implement formatting and CLI argument parsing.
- [ ] **Step 4:** Run tooling tests and architecture checker against the synthetic fixtures.
- [ ] **Step 5:** Commit CLI/diagnostics.

### Task 7: `foundation/contracts` — RED/GREEN

**Files:**
- Create: `foundation/contracts/package.json`
- Create: `foundation/contracts/tsconfig.json`
- Create: `foundation/contracts/src/index.ts`
- Create: `foundation/contracts/src/command-result.ts`
- Create: `foundation/contracts/src/integration-event.ts`
- Create: `foundation/contracts/tests/contracts.test.ts`

**Interfaces:**
- `CommandResult<TSuccess, TRejection>` is a discriminated union with `status: 'success' | 'rejected'`.
- `CommandRejection` is the minimal generic rejection base `{ readonly code: string; readonly message: string }`.
- `IntegrationEvent<TType extends string, TPayload>` carries immutable `type`, `payload`, and owner-provided `occurredAt`/`sequence` only when explicitly supplied; no event bus behavior is added.

- [ ] **Step 1: RED:** Write `expectTypeOf` tests that require discriminated narrowing and readonly minimum event/rejection shape.
- [ ] **Step 2:** Run `pnpm --filter @web-three-city/foundation-contracts test`; expected compile/test failure because contracts do not exist.
- [ ] **Step 3: GREEN:** Implement the minimal types only; do not add gameplay vocabulary, bus, scheduler, persistence, or factories.
- [ ] **Step 4:** Run Foundation tests and typecheck.
- [ ] **Step 5:** Commit Foundation contracts.

### Task 8: `apps/game` executable composition + Three.js shell

**Files:**
- Create: `apps/game/package.json`
- Create: `apps/game/tsconfig.json`
- Create: `apps/game/index.html`
- Create: `apps/game/src/bootstrap/main.ts`
- Create: `apps/game/src/composition/create-game.ts`
- Create: `apps/game/src/ui/create-shell.ts`
- Create: `apps/game/src/presentation/create-scene.ts`
- Create: `apps/game/src/style.css`
- Create: `playwright.config.ts`
- Create: `tests/browser/bootstrap.spec.ts`

**Interfaces:**
- `createGame(mount: HTMLElement): { dispose(): void }` assembles UI and presentation only.
- `createShell(mount)` owns DOM shell creation and status projection.
- `createScene(host)` owns Three.js renderer/camera/resize/render lifecycle and returns `dispose()`; WebGL initialization failure degrades to a stable shell message instead of gameplay fallback state.

- [ ] **Step 1: RED:** Add Playwright browser smoke expecting app shell status and successful startup with no uncaught page errors.
- [ ] **Step 2:** Run browser test once CI/local runtime is available; expected RED until app files exist.
- [ ] **Step 3: GREEN:** Implement bootstrap/composition/UI/presentation modules with no gameplay objects or canonical state.
- [ ] **Step 4:** Build app and run browser smoke; expected GREEN.
- [ ] **Step 5:** Commit executable app shell.

### Task 9: Repository verification, lint, hooks, and CI

**Files:**
- Create: `.husky/pre-commit`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Modify: root `package.json` if verification script adjustments are required.

**Interfaces:**
- Pre-commit runs fast formatting/lint/architecture checks only; CI independently runs the complete verification ladder.
- CI uses Node 22.18.0 and pnpm 10.15.1, installs Chromium for Playwright, then invokes the same root commands available locally.

- [ ] **Step 1:** Add Husky pre-commit hook without making it the sole enforcement gate.
- [ ] **Step 2:** Add GitHub Actions workflow for format/lint/typecheck/unit/tooling/architecture/build/browser smoke.
- [ ] **Step 3:** Add root README documenting exact commands, package ownership, and explicit non-goals.
- [ ] **Step 4:** Commit verification/CI integration.

### Task 10: Full architecture acceptance and remediation

**Files:**
- Modify only files required by verified failures; do not expand scope.

**Interfaces:**
- Root `pnpm verify` is the authoritative full scaffold verification command.

- [ ] **Step 1:** Run/install via CI because the current ChatGPT execution container has no outbound GitHub/package-network access; use the branch workflow as the fresh verification environment.
- [ ] **Step 2:** Inspect exact-head CI jobs/logs. Fix failures using the relevant TDD/debugging cycle rather than weakening binding rules.
- [ ] **Step 3:** Re-run CI until format, lint, typecheck, tests, architecture check, build, and Chromium smoke are all green on one exact HEAD.
- [ ] **Step 4:** Verify branch diff contains no gameplay systems, speculative Foundation packages, generated artifacts, or legacy material.
- [ ] **Step 5:** Record exact tested HEAD in PR/implementation summary.
- [ ] **Step 6:** Only after fresh verification evidence, mark implementation ready for the next integration decision.
