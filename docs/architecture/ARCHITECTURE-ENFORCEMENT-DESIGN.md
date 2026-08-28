# Architecture Enforcement Design

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-28
- **Scope:** Machine-enforceable architecture rules, tooling ownership, source-of-truth derivation, fixtures, reporting, and verification integration
- **Depends on:** Product Architecture, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure, A6 Public Export & Dependency Rules, A7 Composition & Orchestration Structure, A8 Foundation Structure, A9 Testing Structure, A10 Documentation Structure
- **Sequence:** A11 — Architecture Enforcement Design

## 1. Purpose

Architecture rules must be enforceable where they are mechanical.

Core rule:

```text
Architecture prose defines intent and authority.
Architecture tooling verifies mechanically observable conformance.
```

Tooling does not replace architectural judgment for semantic ownership questions, but it must prevent structural rules from depending on reviewer memory alone.

## 2. Tooling owner

Architecture enforcement belongs to:

```text
tooling/architecture
```

This is a repository-tooling package under A3/A4.

Production packages must never depend on it.

It may inspect repository source, package manifests, workspace configuration, export maps, and AST/import metadata as data.

## 3. Enforcement layers

The architecture checker should be decomposed into focused rule families:

```text
workspace/topology rules
package identity/profile rules
manifest dependency rules
export/deep-import rules
namespace dependency rules
system public-surface rules
query graph/cycle rules
contract leak rules
technology boundary rules
document consistency rules where mechanical
```

One mega-rule engine with hidden ad-hoc exceptions is discouraged.

Each rule should have a stable identifier and independently testable behavior.

## 4. Source-of-truth derivation

Architecture tooling derives facts from the current repository, not from a manually maintained dependency graph.

Primary evidence sources:

```text
pnpm workspace configuration
package.json name/dependencies/exports
physical package path
source imports (including import type and dynamic import when statically resolvable)
selected AST/type relationships where needed
binding architecture configuration generated/maintained for current topology only
```

Manual architecture diagrams are explanatory, not graph authority.

## 5. Package discovery

The checker discovers workspace packages from the current workspace definition and validates that each package maps to exactly one A3 ownership namespace/profile.

It must reject or report:

```text
workspace package outside approved ownership namespaces
nested workspace package without explicit architecture approval
package path/name mismatch with A4 naming policy
unclassifiable package profile
production source at repository root when mechanically detectable
```

The root workspace package is classified as control plane, not production package.

## 6. Namespace profile inference

Profile is derived primarily from physical ownership path:

```text
systems/*        -> strict-production/system
foundation/*     -> strict-production/foundation
orchestration/*  -> strict-production/orchestration
apps/*           -> application
testkit/*        -> test-only
tooling/*        -> repository-tooling
```

The checker must not let a package self-declare a weaker profile to escape path-based restrictions.

Any future profile requires an architecture change, not a local config toggle.

## 7. Export boundary checks

The checker validates A4/A6 rules such as:

```text
cross-package import resolves only to target package export path
relative filesystem reach-through across package root is forbidden
tsconfig/bundler alias cannot expose private target path
system root export does not expose known mutation/composition entrypoints
system command/composition subpaths are consumed only by permitted profiles
public contract does not reference private internal path where statically detectable
```

A symbol being reachable through build tooling is insufficient; the target export map and permission profile must both permit the edge.

## 8. Manifest dependency checks

For each cross-package import, the consumer must explicitly declare the target dependency in the appropriate manifest category.

The checker should detect:

```text
undeclared direct dependency
transitive dependency reliance
production source importing dependency classified test/tooling-only
stale declared workspace dependency with no current use (warning initially unless policy later makes it error)
```

Exact package-manager category policy may remain configurable only where architecture has not frozen semantics.

## 9. Namespace dependency matrix checks

At minimum, the checker rejects:

```text
foundation -> systems/orchestration/apps/testkit/tooling
systems -> orchestration/apps/testkit/tooling
production -> testkit/tooling
system -> another system ./commands
system -> another system ./composition
orchestration -> system ./composition
apps -> private package path
```

Foundation-to-Foundation, tooling-to-tooling, testkit-to-testkit, and approved same-layer edges must also satisfy acyclic/review rules where applicable.

## 10. System Query graph

The checker derives direct system-to-system root-read edges from actual imports.

Binding checks:

```text
only root read surface may form system -> system edge
system command/composition edges fail immediately
query graph must be acyclic
```

Cycle detection uses deterministic graph traversal/topological-sort or equivalent.

The tool must output the cycle path when rejecting, for example:

```text
roads -> zoning -> terrain -> roads
```

A manually edited graph file must not be required to keep detection current.

## 11. Reviewed system Query exceptions

Because A3/A6 define direct system reads as forbidden-by-default reviewed exceptions, tooling needs a small current approval mechanism.

Recommended design:

```text
machine-readable architecture policy records only exceptional approved edges
```

Example conceptual record:

```text
systems/roads -> systems/terrain root-read
reason/document reference
```

This file is not the dependency graph; source imports remain graph authority.

Its purpose is only to answer:

```text
Is this otherwise-forbidden direct read edge explicitly approved?
```

The final config format is implementation detail, but approvals must be reviewable, minimal, and reference a binding system/architecture document.

## 12. Composition surface checks

The checker enforces:

```text
systems/* cannot import any ./composition
orchestration/* cannot import system ./composition
apps/* may import approved ./composition surfaces
```

Where statically possible, import-time self-registration patterns may be linted, but semantic service-locator detection may require review rather than pretending tooling can prove it completely.

## 13. Contract leak checks

A11 should mechanically catch obvious violations such as public exported types importing/referencing:

```text
ports/*
private domain entity modules
private application implementation modules
private adapter modules
non-exported internal paths
```

The checker should prefer TypeScript AST/type-graph analysis over filename-only heuristics for exported type references when practical.

It should not claim to prove semantic immutability fully; that remains contract design + tests.

## 14. Technology boundary checks

At minimum, system `domain/` should reject imports from known presentation/browser technology modules such as:

```text
three
DOM/browser-specific application modules
apps/*
orchestration/*
concrete repository tooling/testkit
```

Technology package lists should be current and explicit, not legacy-derived.

A11 may combine architecture checker rules with ESLint where ESLint provides fast local feedback, but ESLint is not the sole authority.

## 15. Internal structure checks

A11 may enforce selected A5 rules mechanically, such as:

```text
domain cannot import application/presentation/composition
application cannot import presentation
system package cannot import apps/orchestration
```

It should not require empty semantic directories or enforce folder ceremony when no code exists.

Alternate approved ECS/data-oriented system layouts require an explicit mapping/profile recognized by tooling rather than disabling architecture checks wholesale.

## 16. Foundation checks

The checker validates:

```text
Foundation package path/name profile
no upward dependencies
Foundation graph acyclic
reserved package existence only when actually created
```

Gameplay-vocabulary detection is primarily semantic review; tooling may flag suspicious names but must not claim authoritative semantic classification from word matching alone.

A package still requires documented A8 creation approval.

## 17. Test boundary checks

The checker should distinguish package-owned tests from external tests.

Mechanically enforceable examples:

```text
systems/roads/tests may import systems/roads internal modules
systems/zoning/tests may not deep-import systems/roads internals
tests/integration/browser/journeys/visual may use public package exports only
testkit may not deep-import production internals
production may not import testkit/test files
```

Exact path patterns align with A9.

## 18. Tooling fixtures

`tooling/architecture` must include deterministic valid/invalid fixtures proving rule behavior.

Recommended structure:

```text
tooling/architecture/
├─ src/
├─ tests/
└─ fixtures/
   ├─ valid/
   └─ invalid/
```

Fixture scenarios should include at least:

```text
valid exported dependency
invalid deep import
invalid relative cross-package import
undeclared dependency
system -> system command violation
system Query approved edge
system Query unapproved edge
system Query cycle
foundation upward dependency
production -> testkit/tooling
public contract -> internal port leak
apps composition allowed edge
orchestration composition forbidden edge
```

Each invalid fixture should fail for one primary intended reason where practical.

## 19. Rule identifiers and diagnostics

Every failure should include:

```text
stable rule id
consumer package/path
target package/path when relevant
human-readable reason
binding architecture document/section reference
suggested category of fix, not automatic unsafe rewrite
```

Example concept:

```text
ARCH-SYS-003
systems/zoning -> @web-three-city/roads/commands
Systems may not import another system's mutation surface.
See ADR-001 / A6.
```

Stable rule IDs make CI, documentation, and code review references durable.

## 20. Severity model

Default architecture violations are errors when the rule is binding and mechanical.

Warnings are reserved for erosion indicators or advisory conditions that architecture has not made hard-invalid.

Do not downgrade known binding violations to warnings merely to keep CI green.

## 21. Local verification integration

Architecture checks must be runnable in the fast developer/owner loop.

Target concept:

```text
pnpm architecture:check
```

Exact script name is implementation detail, but the capability must be directly runnable locally and in CI.

Focused rule tests for tooling should run faster than browser suites.

## 22. CI integration

CI invokes the same architecture tooling used locally.

GitHub Actions YAML should not duplicate rule logic.

Conceptually:

```text
CI
  -> install
  -> lint/typecheck/tests as required
  -> architecture checker
```

Exact pipeline ordering and selective verification policy are implementation/bootstrap concerns.

## 23. Architecture policy configuration

Configuration should be minimal and declarative.

Good candidates for machine-readable policy:

```text
approved direct system read exceptions
approved non-default same-layer exception
approved alternate internal layout mapping
```

Do not encode every dependency manually.

If source/manifests can derive a fact, derive it.

Every exception record must include a current architecture/spec reference and should disappear when no longer needed.

## 24. No broad ignore mechanism

The architecture checker must not provide an easy blanket disable such as:

```text
ignore package
ignore folder recursively
allow all deep imports here
```

Exceptions should be narrow, typed to a rule, justified, and reviewable.

Generated/vendor files may require scoped exclusion, but such exclusion is not a way to exempt owned production code.

## 25. Deterministic checker behavior

Given the same repository tree/configuration, the checker should produce deterministic findings/order.

Diagnostics should be stably sorted, for example by:

```text
rule id
consumer package
source path
target path
```

Architecture verification must not depend on filesystem traversal order.

## 26. Performance goal

Architecture checks are intended for frequent local use.

Design goals:

```text
incremental/focused execution possible later
full repository architecture check remains practical
no browser startup required
no network access required for structural checks
```

Selective Verification is a later concern; A11 should expose structured findings/dependency data that a future resolver can consume without pre-designing that resolver now.

## 27. Output as data

The checker should support both human-readable diagnostics and structured machine output.

Structured output may include:

```text
packages discovered
profile classification
dependency edges
query graph
violations with rule ids
```

This supports CI and future selective verification while keeping source-derived facts authoritative.

## 28. Documentation consistency checks

A11 may later lint simple mechanical documentation properties such as:

```text
FROZEN doc contains TODO/TBD placeholder
required status header missing
dead dependency document path/reference
```

It should not attempt to algorithmically decide semantic architecture correctness from prose.

## 29. Architecture enforcement does not replace review

Some rules remain human-semantic by nature:

```text
Does this capability truly belong in Foundation?
Is this orchestration concern coherent?
Is this DTO semantically immutable?
Does a package split represent real ownership?
```

Tooling should flag structural symptoms, but architecture review remains authority for semantics.

## 30. Anti-pattern checklist

- [ ] manual dependency graph is treated as authority;
- [ ] checker relies only on ESLint and misses package/export graph;
- [ ] profile can be weakened by package-local config;
- [ ] broad ignore disables architecture for owned code;
- [ ] architecture violations are warnings despite binding rule;
- [ ] CI YAML duplicates hidden architecture logic;
- [ ] checker ignores `import type` dependencies;
- [ ] deep imports through relative/alias paths escape detection;
- [ ] system Query cycle error does not show cycle path;
- [ ] exceptions have no binding document reference;
- [ ] fixtures test only valid cases, not invalid rules;
- [ ] tooling claims to prove semantic ownership/immutability it cannot observe;
- [ ] old static topology map is reused instead of deriving current graph.

## 31. Acceptance scenarios

A11 design is sufficient when the planned checker can distinguish:

```text
valid app -> system composition
invalid system -> system composition
valid reviewed system root Query
invalid unreviewed system root Query
invalid system Query cycle
valid package-owned internal test
invalid external-test deep import
valid tooling source inspection
invalid production -> tooling import
valid Foundation -> Foundation public edge
invalid Foundation -> system edge
valid exported type
invalid public contract -> internal port leak
```

## 32. Deferred decisions

A11 intentionally does not freeze:

```text
exact implementation language/library
exact parser/AST library
exact config filename/schema
selective verification resolver
incremental cache implementation
CI matrix/job names
pre-commit hook implementation
```

## 33. Final invariants

```text
Architecture rules are executable where mechanically observable.
Architecture docs remain semantic authority.
Tooling lives in tooling/architecture.
Production never depends on architecture tooling.
Workspace/manifests/imports derive the current graph.
Manual graph files are never dependency authority.
All import forms, including type-only and relative reach-through, count.
System Query graph is automatically derived and acyclic.
Exceptions are narrow, explicit, documented, and machine-readable.
No broad ignore mechanism for owned production code.
Architecture checker has valid/invalid fixtures.
Local and CI use the same rule engine.
Diagnostics are deterministic and reference binding rules.
Tooling does not pretend to automate semantic ownership judgment.
```