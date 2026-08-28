# Testing Structure

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-28
- **Scope:** Test ownership, placement, layering, reusable test infrastructure, and repository verification structure
- **Depends on:** Product Architecture, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure, A6 Public Export & Dependency Rules
- **Sequence:** A9 — Testing Structure

## 1. Purpose

Testing structure follows architectural ownership.

Core rule:

```text
A test belongs as close as possible to the authority/contract it proves.
Move it upward only when the behavior crosses ownership or technology boundaries.
```

Browser testing is not the default correctness layer for domain/application behavior.

## 2. Test ownership classes

Tests are classified by ownership, not merely by framework.

```text
package-owned focused tests
package-owned contract/integration tests
cross-package integration tests
browser tests
critical journeys
visual tests
architecture/tooling tests
```

Each class has a distinct home and boundary expectation.

## 3. Package-owned focused tests

Default placement:

```text
<package>/src/**/*.test.ts
```

Purpose:

```text
pure domain rules
application behavior
small adapter/projection behavior
internal invariant tests
focused regression tests
```

These tests share the package ownership boundary and may access internals when appropriate under A4.

They should not boot the browser, full product, or unrelated systems unless the behavior genuinely requires them.

## 4. Package-owned integration and contract tests

Default placement:

```text
<package>/tests/
```

Typical purposes:

```text
package public contract verification
application + domain integration
package composition factory verification
integration among multiple internal layers
package-local persistence/adapter integration when later applicable
```

Contract tests whose purpose is to prove external behavior should exercise declared public exports rather than internal files.

Package-level integration does not automatically mean browser-level testing.

## 5. Cross-package integration tests

Default placement:

```text
tests/integration/
```

Use only when the behavior being verified genuinely spans more than one architectural owner.

Examples:

```text
system Query contract consumed by another package
orchestration across multiple system Commands
composition adapter joining consumer-owned port to provider Query
Foundation capability integrated with a system through public contracts
```

Cross-package tests are external consumers and must use approved public boundaries.

They receive no friend/deep-import access.

## 6. Browser tests

Default placement:

```text
tests/browser/
```

Browser tests are reserved for behavior where the browser is part of the requirement, such as:

```text
DOM/bootstrap integration
pointer/touch/browser input behavior
WebGL/Three.js browser integration
browser storage integration
routing/shell behavior
actual browser permission/capability behavior
```

Do not use browser tests merely because a gameplay feature is visible in the browser.

If domain/application correctness can be proven without browser startup, prove it lower in the test pyramid first.

## 7. Critical journey tests

Default placement:

```text
tests/journeys/
```

Critical journeys verify a small set of product-level flows across multiple boundaries.

They are not a replacement for owning-system tests.

A journey should exist because the end-to-end interaction has product value/risk that cannot be sufficiently represented by lower-level tests.

Journey suites remain intentionally small.

## 8. Visual tests

Default placement:

```text
tests/visual/
```

Use when visual output itself is an acceptance authority.

Potential examples:

```text
layout/overlay regression
Three.js scene projection appearance
important interaction-state visual regression
```

Visual tests should not be used to infer hidden domain correctness.

A passing screenshot cannot replace semantic tests for gameplay state.

## 9. Architecture and tooling tests

Architecture enforcement is owned by repository tooling.

Default placement:

```text
tooling/architecture/tests/
tooling/architecture/fixtures/
```

These tests verify the architecture checker itself using valid and invalid fixture repositories/packages.

They are not placed under `tests/integration/` by default because the owner is `tooling/architecture`, not gameplay integration.

## 10. `testkit/*`

`testkit/*` exists only for genuinely reusable cross-package testing capabilities.

Examples may include:

```text
deterministic test harnesses
shared public-contract builders
browser driver abstractions
reusable clock/random test doubles after corresponding Foundation contracts exist
```

Rules:

```text
production -> testkit forbidden
testkit consumes production packages through public APIs only
no private deep imports
testkit does not contain gameplay implementation
```

Do not create `testkit` package merely because two tests share a helper function.

## 11. System-specific fixtures

A fixture used only by one package stays inside that package.

Suggested ownership:

```text
systems/roads/tests/support/
```

or another package-local test-support location defined by the package.

Do not promote fixtures to `testkit/*` until semantic test reuse across owners is real and stable.

## 12. Test doubles and ports

When an owner depends on an internal port, package-owned tests may provide owner-local fakes/stubs for that port.

A test double should model the contract required by the consumer, not duplicate provider internals.

For cross-package integration, prefer real public provider capability through composition unless the test's purpose specifically requires a controlled fake.

## 13. Contract verification

Every deliberately exported contract requires automated verification appropriate to its semantics.

Examples:

```text
read Query returns semantically immutable values
Command success and typed rejection behavior
Integration Event discriminator/payload shape
composition factory accepts only approved dependency interfaces
public export map does not leak private paths
```

Snapshot tests may assist but should not replace clear semantic assertions where explicit assertions are practical.

## 14. Determinism tests

Determinism is a Product Architecture invariant, but exact scheduler/RNG semantics are not yet frozen.

A9 freezes only the placement principle:

```text
determinism behavior owned by one package
-> package tests

repository-wide deterministic replay/integration behavior
-> cross-package/repository tests after runtime architecture exists
```

Do not invent full replay fixtures before the governing runtime/persistence designs exist.

## 15. Test data ownership

Test data should be generated from current contracts/specifications.

Do not retain pre-reset fixtures, snapshots, save files, or screenshots as default authority under ADR-000.

A test artifact becomes current evidence only when created for a current requirement.

## 16. Test naming

Tests should communicate the contract/behavior they prove, not implementation trivia.

Prefer:

```text
build-road.rejects-occupied-cell.test.ts
road-query.returns-snapshot.test.ts
```

over names that mirror only a class method with no behavioral intent.

A9 does not mandate one exact filename grammar across every test type, but test purpose must remain discoverable.

## 17. Test dependency rules

Tests obey package boundaries.

```text
package-owned test -> may access same-package internals
external/cross-package test -> public APIs only
browser/journey/visual -> product/application public behavior only
```

Tests must not create architecture relationships that production code itself is forbidden to create merely for setup convenience.

Example:

```text
systems/zoning/tests deep-imports Roads internals
-> forbidden
```

## 18. Verification ladder

Default verification order favors the cheapest authoritative layer:

```text
focused owner tests
  ↓
package contract/integration tests
  ↓
affected cross-package integration
  ↓
architecture/tooling checks when structure changes
  ↓
targeted browser tests when browser-observable
  ↓
critical journey / visual evidence when required
  ↓
repository-wide/full gates when risk or release policy requires
```

This is a verification strategy, not a frozen selective-verification resolver implementation.

## 19. Browser minimization rule

A browser test is justified when at least one required behavior depends on actual browser/DOM/WebGL/runtime behavior.

Do not escalate to browser simply because:

```text
feature has UI
Three.js eventually renders it
it feels more realistic
```

Core gameplay rules should remain testable without DOM/WebGL startup.

## 20. Flakiness policy

A flaky test is not accepted as normal product behavior.

Tests should control nondeterministic inputs where possible and avoid arbitrary timing sleeps.

When asynchronous/browser behavior is required, tests should wait on explicit observable conditions rather than fixed delays.

Exact runtime determinism utilities are deferred until the corresponding architecture exists.

## 21. Test isolation

Focused tests should not depend on execution order or mutable global state from another test.

Cross-package/browser suites should establish and dispose their required environment explicitly.

Shared mutable global fixtures are discouraged because they obscure ownership and failure causality.

## 22. Failure evidence

A failing test should make it possible to identify:

```text
which owner/contract failed
what input/condition was used
what outcome was expected
what outcome occurred
```

Tests should avoid opaque mega-fixtures that require booting the entire product to diagnose one system rule.

## 23. Test creation rule

Add the narrowest test that can authoritatively prove the requirement.

Examples:

```text
pure Terrain calculation
-> unit/domain test

Roads public Query shape
-> Roads contract test

Roads reads Terrain through adapter
-> cross-package integration test

pointer gesture arbitration
-> browser test

critical new-game-to-first-road flow
-> journey only if product risk justifies it
```

## 24. Anti-pattern checklist

- [ ] every feature requires browser test by default;
- [ ] package unit tests boot unrelated systems;
- [ ] external test deep-imports private package code;
- [ ] testkit becomes shared gameplay code;
- [ ] system-specific fixture is promoted globally without real reuse;
- [ ] screenshot used as sole proof of domain correctness;
- [ ] journey suite duplicates all lower-level scenarios;
- [ ] flaky timing sleep is accepted instead of explicit condition;
- [ ] tests depend on run order/global mutable fixture;
- [ ] architecture checker has no valid/invalid fixture tests;
- [ ] old pre-reset snapshots/fixtures are treated as current expected behavior;
- [ ] one full-product mega-test is used where focused owner test is sufficient.

## 25. Definition of Done examples

```text
Road domain invariant
-> systems/roads/src/**/*.test.ts

Roads public Query contract
-> systems/roads/tests/

Roads + Terrain public-contract integration
-> tests/integration/

browser pointer/touch behavior
-> tests/browser/

critical product flow across UI + multiple owners
-> tests/journeys/ when justified

visual grid-overlay regression
-> tests/visual/

architecture import-rule fixture
-> tooling/architecture/fixtures + tests

Road-only fixture builder
-> systems/roads/tests/support

generic reusable deterministic test harness
-> testkit/<approved capability> only when cross-owner reuse is real
```

## 26. Deferred decisions

A9 intentionally does not freeze:

```text
exact test runner/library versions
coverage percentage targets
selective verification resolver algorithm
release-gate policy details
runtime replay/determinism test semantics
browser device matrix
visual baseline storage provider
```

## 27. Final invariants

```text
Testing follows ownership.
Use the narrowest authoritative test layer.
Package-owned tests may access package internals.
External tests use public boundaries only.
Browser is not the default correctness layer.
Critical journeys remain few and product-risk driven.
Visual tests prove visual authority, not hidden domain semantics.
Testkit is reusable test infrastructure, never production gameplay code.
Architecture tooling tests its own rules with valid/invalid fixtures.
Current tests are created from current requirements; legacy fixtures are not authority.
Flakiness and hidden global state are not accepted as normal test design.
```