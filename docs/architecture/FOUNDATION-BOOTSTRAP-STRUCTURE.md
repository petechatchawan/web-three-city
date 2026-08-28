# Foundation Bootstrap Structure

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-28
- **Scope:** Initial clean-slate workspace scaffold required to make the frozen Architecture & Structure executable without introducing gameplay systems
- **Depends on:** Product Architecture, ADR-000, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure, A6 Public Export & Dependency Rules, A7 Composition & Orchestration Structure, A8 Foundation Structure, A9 Testing Structure, A10 Documentation Structure, A11 Architecture Enforcement Design
- **Sequence:** A12 — Foundation Bootstrap Structure

## 1. Purpose

A12 defines the first physical repository scaffold that proves the Architecture & Structure contracts before gameplay implementation begins.

Core rule:

```text
Bootstrap proves architecture.
Bootstrap does not pre-create gameplay.
```

The scaffold must be minimal, executable, mechanically verifiable, and free of speculative packages.

## 2. Bootstrap goals

The initial scaffold should prove that the repository can support:

```text
ownership-first workspace namespaces
explicit package boundaries
package exports/dependency rules
composition root
Foundation contract primitive package
architecture enforcement tooling
package-local and repository-level testing structure
minimal browser application shell
CI/local verification hooks
```

It must not prove Terrain, Roads, simulation scheduling, persistence transactions, ECS, or other gameplay behavior.

## 3. Bootstrap non-goals

A12 must not create or define:

```text
World
Terrain
Terraform
Roads
Zoning
Buildings
Households
Economy
Mobility
Traffic
Water
simulation calendar/tick semantics
scheduler phases
RNG semantics
production persistence/save schema
event durability/outbox
ECS runtime
visual-fidelity systems
```

No gameplay package is created merely to demonstrate package boundaries.

Architecture checker fixtures are sufficient to prove package rules.

## 4. Initial repository tree

The target initial scaffold is conceptually:

```text
/
├─ apps/
│  └─ game/
│
├─ foundation/
│  └─ contracts/
│
├─ tooling/
│  └─ architecture/
│
├─ tests/
│  └─ browser/          # only when minimal shell smoke exists
│
├─ docs/
│  └─ architecture/
│
├─ .github/
│  └─ workflows/
│
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig*.json
├─ eslint/prettier config
└─ lockfile/configuration required by approved toolchain
```

Directories are created only when files exist. Empty `systems/`, `orchestration/`, `testkit/`, or reserved Foundation packages are not required.

## 5. Workspace control plane

Repository root owns only workspace/tooling control-plane responsibilities.

Bootstrap establishes:

```text
workspace package manager configuration
root scripts
shared TypeScript compiler baseline
lint/format configuration
repository metadata
Git hooks/CI entrypoints when approved
```

Root must not become a production shared library.

## 6. Toolchain baseline

The current architecture direction assumes a modern TypeScript web toolchain such as:

```text
Node.js 22+
pnpm
TypeScript
Vitest
ESLint
Prettier
Playwright
Husky
GitHub Actions
Three.js in application/presentation boundary
```

Exact versions and script names are implementation-plan decisions and must be pinned before execution.

Tool selection may change during implementation planning if a current requirement or compatibility constraint justifies it; such change must preserve A3–A11 architecture contracts.

## 7. `foundation/contracts` bootstrap package

This is the only Foundation package currently sufficiently governed for initial creation because ADR-001 defines its generic primitives.

Package identity:

```text
foundation/contracts
-> @web-three-city/foundation-contracts
```

Initial responsibility is minimal:

```text
generic CommandResult / CommandRejection primitive
minimum generic IntegrationEvent primitive
```

It must not contain gameplay-specific Commands, IDs, event names, DTOs, or rejection codes.

Its public root surface is explicit through `package.json` `exports`.

No speculative composition surface is created unless real construction behavior exists.

## 8. `tooling/architecture` bootstrap package

Package identity:

```text
tooling/architecture
-> @web-three-city/tooling-architecture
```

It owns implementation of A11 mechanical architecture checks.

Initial rule set should prove at least:

```text
workspace package discovery/profile classification
A4 package naming
export/deep-import boundary
cross-package dependency declaration
namespace dependency matrix
system read/command/composition permissions via fixtures
repository-level test public-surface permissions
system Query graph cycle detection
Foundation upward dependency rejection
production -> testkit/tooling rejection
public-contract/private-port leak detection at the practical first level
```

It contains valid/invalid fixtures and focused tests.

The checker operates on current repository/fixture topology only and must not use pre-reset maps/code.

## 9. Architecture fixtures instead of gameplay packages

Do not create fake production packages under `systems/*` solely to test architecture rules.

Use isolated fixture workspaces/packages under:

```text
tooling/architecture/fixtures/
```

Conceptual fixture packages may use generic names such as:

```text
alpha
beta
consumer
provider
```

or clearly synthetic system names.

Fixtures are test data, not production topology and must not be included as normal workspace production packages.

## 10. `apps/game` bootstrap package

Package identity:

```text
apps/game
-> @web-three-city/app-game
```

Initial responsibilities:

```text
browser entrypoint
minimal bootstrap
composition boundary
minimal UI/presentation shell
optional minimal Three.js scene startup sufficient to prove browser/application integration
```

It contains no gameplay rules.

Recommended initial internal structure when files exist:

```text
apps/game/src/
├─ bootstrap/
├─ composition/
├─ ui/
└─ presentation/
```

No empty directories are created simply to match this model.

## 11. Minimal browser shell

The browser shell should prove only that the application package can build/start under the chosen web toolchain.

Acceptable minimal behavior may be:

```text
page mounts successfully
application bootstrap completes
optional Three.js renderer/canvas initializes
no gameplay system exists
```

A blank/minimal product shell is valid.

Do not add fake Terrain/city entities to make the scaffold look like a game.

## 12. Three.js boundary proof

If Three.js is included in Bootstrap, it must remain inside `apps/game` presentation/application boundary.

Bootstrap should demonstrate structurally:

```text
Three.js dependency exists in app/presentation
Foundation/domain-like packages do not import Three.js
```

No gameplay rendering architecture is inferred from this smoke proof.

## 13. Test structure bootstrap

Initial tests should include only what the scaffold owns:

```text
foundation/contracts package tests
tooling/architecture rule/fixture tests
apps/game focused bootstrap tests when useful
minimal browser smoke under tests/browser when actual browser behavior exists
```

No empty `tests/integration`, `tests/journeys`, or `tests/visual` directories are needed before real tests exist.

## 14. Architecture checker fixture coverage

Initial invalid fixtures should cover at least:

```text
deep import by package subpath
relative cross-package reach-through
undeclared workspace dependency
system -> system command import
system -> system composition import
orchestration -> system composition import
Foundation -> system dependency
production -> testkit dependency
production -> tooling dependency
testkit -> system command/composition privilege violation
system Query cycle
public read/command contract references internal port
package name/path profile mismatch
```

Initial valid fixtures should cover at least:

```text
approved system root-read edge
apps -> system composition
orchestration -> system command
repository tests -> exported system command
repository tests -> exported system composition
Foundation -> Foundation public dependency
```

Each fixture proves architecture behavior only; it does not create production topology.

## 15. Current direct-system-read approval fixture

Because no real systems exist, architecture tooling proves A3/A6 reviewed Query-exception behavior with synthetic fixtures.

Fixture design should show:

```text
consumer system -> provider root read surface
approved exception record exists
edge is acyclic
-> PASS
```

and:

```text
same edge without approval
-> FAIL
```

A cycle fixture must fail and report its path.

## 16. Dependency inversion fixture

Bootstrap should include a structural fixture proving the cycle-breaking model:

```text
Consumer owns internal ReadPort
apps/game-like synthetic composition adapter implements/wires it
adapter calls Provider root Query
Consumer does not import Provider in inverted direction
no package cycle
```

The fixture demonstrates architecture, not gameplay semantics.

## 17. Public surface fixture

Synthetic system fixture should prove:

```text
"."             read only
"./commands"    mutation
"./composition" construction
```

and the A6 production + repository-test consumer rules.

This does not create a real system package in production tree.

## 18. Local scripts

Implementation plan should provide concise root commands for at least:

```text
format/check
lint
typecheck
unit/tooling tests
architecture check
build
minimal browser smoke
```

Exact names are not frozen in A12, but each capability must be directly invokable and suitable for CI reuse.

Avoid scripts whose semantics exist only inside CI YAML.

## 19. CI structure

Initial CI should call the same local commands used by developers.

Conceptual gate:

```text
install
  ↓
format/lint
  ↓
typecheck
  ↓
unit/tooling tests
  ↓
architecture check
  ↓
build
  ↓
minimal browser smoke when required
```

Exact job parallelization/order may be optimized in the implementation plan as long as all required evidence remains visible.

## 20. Pre-commit/local feedback

Pre-commit checks may run a focused subset that materially shortens feedback, such as format/lint/fast architecture checks.

Do not make pre-commit the only enforcement layer; CI must independently validate required architecture gates.

## 21. Exact-head and clean-worktree evidence

For the clean-slate bootstrap merge gate, verification should record the exact tested commit and ensure generated/uncommitted changes do not hide the actual reviewed state where repository policy requires it.

These are current workflow decisions, not inherited tooling assumptions.

Exact implementation belongs in the execution plan.

## 22. No selective verification yet

Bootstrap should expose enough structured architecture/package data for a future affected-test resolver, but must not design or implement Selective Verification before real topology and test ownership exist.

Initial repository verification may run the complete small scaffold suite because it is intentionally tiny.

## 23. No runtime/persistence packages before governing ADRs

Do not create:

```text
foundation/runtime
foundation/deterministic
foundation/event-bus
foundation/persistence
foundation/spatial
```

until the A8 creation-gate prerequisites are satisfied.

The Bootstrap must not weaken this rule simply to prepare folders in advance.

## 24. No `systems/*` package before system design

The first gameplay system package is created only after:

```text
Architecture & Structure batch is frozen
relevant repository-wide behavioral ADR prerequisites are frozen
the system design/spec itself is approved
A3 package-creation questions are answered
```

A12 does not select the first gameplay system.

## 25. Bootstrap implementation sequence

Recommended later execution order:

```text
1. root workspace/toolchain control plane
2. tooling/architecture package + RED fixture tests
3. foundation/contracts package + tests
4. apps/game minimal package + composition/bootstrap shell
5. architecture checks across real scaffold
6. build/typecheck/lint/format
7. minimal browser smoke if actual browser shell is present
8. CI/local verification integration
9. exact-head/clean-worktree verification
```

Implementation must follow a reviewed TDD/implementation plan; A12 itself does not authorize code execution.

## 26. Bootstrap acceptance gate

The scaffold is complete only when current requirements are evidenced, conceptually:

```text
workspace install                    PASS
format/check                         PASS
lint                                 PASS
typecheck                            PASS
foundation/tooling/app focused tests PASS
architecture fixture suite           PASS
architecture check on real scaffold  PASS
build                                PASS
minimal browser smoke (if applicable) PASS
no speculative packages              PASS
exact reviewed HEAD evidence          PASS
clean worktree evidence               PASS
```

A browser smoke is required only if Bootstrap includes real browser startup behavior; it is not used to prove domain architecture.

## 27. Structural acceptance

Repository tree must demonstrate:

```text
root is control plane only
apps/game is executable/composition owner
foundation/contracts is generic only
tooling/architecture is repository-tooling owner
no gameplay systems/orchestration packages exist speculatively
no reserved Foundation packages exist speculatively
all workspace packages have explicit exports/dependencies
architecture checker passes current scaffold
```

## 28. Documentation acceptance

Before Bootstrap implementation starts:

```text
A3–A12 Architecture & Structure documents are reviewed/frozen
existing FOUNDATION-BOOTSTRAP.md is reconciled with A12 or superseded cleanly
implementation/TDD plan references current frozen docs only
```

No implementation agent should need chat history to understand the scaffold target.

## 29. Relationship to existing `FOUNDATION-BOOTSTRAP.md`

The current `docs/architecture/FOUNDATION-BOOTSTRAP.md` predates the completed A3–A12 structural sequence and remains a reviewed design baseline until the batch review is complete.

After A12 approval, reconcile it in one of two ways:

```text
A. update FOUNDATION-BOOTSTRAP.md to become the concise executable bootstrap specification and keep A12 as structural authority
or
B. supersede/merge it if maintaining both would duplicate authority
```

The batch review should choose one primary authority before implementation planning.

## 30. Anti-pattern checklist

- [ ] fake gameplay system created to prove package rules;
- [ ] empty systems/orchestration/Foundation directories created for appearance;
- [ ] runtime/persistence packages created before governing design;
- [ ] root package becomes shared production library;
- [ ] architecture checker copies a manual package graph;
- [ ] architecture fixtures are treated as production workspace packages;
- [ ] minimal app shell contains fake gameplay logic;
- [ ] Three.js leaks into Foundation/contracts;
- [ ] CI contains rule logic unavailable locally;
- [ ] pre-commit is the only architecture gate;
- [ ] Selective Verification is prematurely rebuilt before real topology exists;
- [ ] legacy tooling or package maps are consulted by default;
- [ ] Bootstrap implementation begins before A3–A12 and execution plan approval.

## 31. Definition of Done examples

```text
@web-three-city/foundation-contracts exists with generic primitives only
-> valid Bootstrap package

@web-three-city/terrain created to test export rules
-> invalid speculative gameplay package

@web-three-city/tooling-architecture owns checker + fixtures
-> valid

apps/game renders minimal canvas/shell with no gameplay
-> valid

foundation/runtime empty placeholder package
-> invalid

architecture fixture contains synthetic roads/terrain names outside production workspace
-> valid fixture if clearly synthetic

CI calls same architecture checker command as local
-> valid
```

## 32. Deferred decisions after A12

After Architecture & Structure is frozen, behavioral architecture resumes as separately approved work, including:

```text
Simulation Runtime / Scheduler / Determinism
Persistence / Transaction / Event Delivery / Save Ownership
Data-Oriented / ECS Boundary
World / Spatial architecture
first gameplay system design
```

The exact order can be reviewed after the structural batch is accepted.

## 33. Final invariants

```text
Bootstrap proves architecture, not gameplay.
Create only packages with current ownership/governing decisions.
Initial production packages are minimal: apps/game and justified Foundation capability only.
tooling/architecture proves structural rules through synthetic fixtures.
No fake gameplay packages for architecture testing.
No empty speculative packages/directories.
Root remains workspace control plane.
Three.js, if present, stays in app/presentation boundary.
Local and CI verification use the same underlying checks.
No Selective Verification redesign before real topology exists.
No runtime/persistence/spatial Foundation package before its governing design.
A3–A12 must be reviewed/frozen before Bootstrap implementation planning begins.
```