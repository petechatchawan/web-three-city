# Foundation Bootstrap

- **Status:** REVIEWED DESIGN BASELINE — IMPLEMENTATION BLOCKED
- **Date:** 2026-08-28
- **Scope:** First executable repository scaffold for the Product Architecture
- **Depends on:** Product Architecture, Product Architecture Blueprint, ADR-000, ADR-001
- **Implementation prerequisites:** ADR-002, ADR-003, ADR-004 must be frozen first

## Purpose

Foundation Bootstrap is the first implementation slice of the clean-slate Product Architecture.

Its job is not to implement city-builder gameplay. Its job is to make the architectural contracts executable, testable, and difficult to violate accidentally.

The Bootstrap therefore establishes:

- repository/toolchain baseline;
- workspace topology;
- package export conventions;
- architecture enforcement;
- minimum approved foundation capabilities;
- minimal browser application shell;
- test/documentation conventions;
- CI and local verification baseline.

## Non-goals

Foundation Bootstrap MUST NOT implement:

```text
Terrain
Terraform
Roads
Zoning
Buildings
Population/Households
Economy
RCI
Mobility
Traffic
Water
production save schema
production gameplay calendar
visual fidelity work
```

No gameplay package is created merely to demonstrate the architecture. Test fixtures are sufficient.

## Process/tooling baseline

Under ADR-000, useful process/tooling conventions from the former repository are adopted by default unless incompatible with the new topology.

Bootstrap should therefore re-establish, adapting where necessary:

- trunk-based development discipline;
- exact-head verification evidence;
- clean-worktree verification evidence;
- verification ladder principles;
- PR/Issue workflow conventions;
- CI quality-gate discipline;
- pre-commit quality checks;
- concise handoff-ready architecture/system documentation conventions.

This does not mean copying obsolete verification code unchanged. Tooling that embeds old package names or dependency maps must be redesigned for the new topology.

## Toolchain baseline

Candidate baseline to be frozen in the Bootstrap specification/plan:

```text
Node.js 22+
pnpm workspace
TypeScript
Vitest
ESLint
Prettier
Playwright
Husky
GitHub Actions
Three.js for application/presentation boundary
```

The Bootstrap design assumes this family because it is proven in the repository, but exact versions and scripts are implementation-plan details and must be pinned before implementation.

## Workspace topology

Target workspace discovery:

```yaml
packages:
  - apps/*
  - foundation/*
  - systems/*
  - orchestration/*
  - testkit/*
```

Top-level namespaces correspond to architecture; a generic `packages/*` architectural bucket is not used.

Empty workspace packages are forbidden.

## Packages Bootstrap may create

Only capabilities with an approved governing contract may be created.

Expected set after ADR-002/003/004 are frozen:

```text
apps/game

foundation/contracts
foundation/runtime
foundation/deterministic
foundation/event-bus
foundation/persistence

testkit/system-testkit
```

Creation is conditional on the governing ADR defining enough behavior to justify a real package.

### Not created speculatively

```text
foundation/spatial
systems/world
systems/terrain
systems/roads
orchestration/gameplay
orchestration/persistence
```

`foundation/spatial` waits for the World/Spatial design unless an earlier approved need emerges.

Orchestration packages are created only when a real cross-system behavior exists.

## Governance matrix

```text
Capability                Governing authority
-----------------------------------------------------------------
foundation/contracts      Product Architecture + ADR-001
foundation/runtime        ADR-002
foundation/deterministic  ADR-002
foundation/event-bus      ADR-001 + ADR-003
foundation/persistence    ADR-003
system internal variants  ADR-004 when data-oriented/ECS-specific
```

Foundation Bootstrap MUST NOT invent semantics that a governing ADR has intentionally deferred.

## Minimal `apps/game`

The Bootstrap application proves browser composition without implementing gameplay.

Minimum behavior:

```text
browser entry
  ↓
bootstrap shell
  ↓
composition root
  ↓
initialize minimal presentation/frame boundary
  ↓
render an empty application/world shell
```

The purpose is to prove:

- the workspace builds;
- the browser application starts;
- Three.js/presentation stays above gameplay foundation;
- foundation packages remain testable without browser startup;
- composition-only surfaces can be wired from `apps/game`.

No city simulation behavior is required.

## System export convention proof

Bootstrap must include fixture packages or architecture test fixtures proving the three surface model:

```text
"."             read/observe
"./commands"    mutate
"./composition" construct/wire
```

The fixture must prove the permission matrix:

```text
Consumer          "."    "./commands"    "./composition"
---------------------------------------------------------
systems/*          YES         NO                NO
orchestration/*    YES         YES               NO
apps/*             YES         YES               YES
```

This proof should not require real gameplay systems.

## Architecture enforcement

Architecture enforcement is a primary Bootstrap deliverable, not cleanup work.

The implementation should use deterministic repository tooling/tests that inspect package exports and import relationships. ESLint rules may supplement the checks but MUST NOT be the only authority.

Required failures include:

```text
foundation -> systems/orchestration/apps
systems -> orchestration/apps
system -> another system ./commands
system -> another system ./composition
orchestration -> system ./composition
cross-package deep filesystem import
undeclared package export import
public read/command contract -> internal ports type
direct system Query dependency cycle
domain -> Three.js
domain -> DOM/browser API
domain -> concrete event-bus implementation
```

Architecture tooling itself requires automated tests using valid and invalid fixture graphs/imports.

## Query graph proof

Bootstrap architecture tooling must be able to derive direct system Query edges from real workspace/package imports and reject a cycle with topological-sort or equivalent deterministic cycle detection.

It must also prove a cycle-breaking fixture using the ADR-001 dependency-inversion pattern:

```text
System A directly queries System B root surface
System B needs information owned by System A
System B depends on a B-owned internal ReadPort instead of importing System A
apps/game composition wires an adapter that calls System A's root Query surface
there is no reverse package import from B to A
```

The same pattern applies symmetrically when the opposite direction is chosen. The consumer owns the internal read port; composition wires the provider query.

No manually maintained query graph is authority.

## Contracts and ports proof

Bootstrap fixtures/tests must prove:

- `contracts/*` does not become public automatically;
- package exports define public authority;
- read/command public contracts cannot reference internal `ports/*` types;
- composition-only wiring interfaces do not leak into read/command surfaces;
- generic `CommandResult` and minimum `IntegrationEvent` contracts compile and have semantic tests.

## Runtime and determinism

Bootstrap may implement `foundation/runtime` and `foundation/deterministic` only after ADR-002 is frozen.

ADR-002 must define at minimum:

- canonical simulation clock/tick authority;
- deterministic scheduling order;
- simulation versus render-frame separation;
- registration/failure semantics;
- minimum deterministic RNG/seed primitives required by runtime contracts.

Bootstrap does not invent a production calendar or gameplay cadence.

## Event delivery and persistence

Bootstrap may implement `foundation/event-bus` and `foundation/persistence` only after ADR-003 is frozen enough to define their minimum responsibilities.

ADR-003 must reconcile:

- single-authority commit boundary;
- owning-system event collection;
- post-commit visibility;
- delivery failure semantics;
- durability/outbox/recovery decision;
- save ownership/versioning/migration boundary.

The Bootstrap event bus must not become a workflow engine, command bus, scheduler, transaction coordinator, or global state store.

## Data-oriented / ECS boundary

ADR-004 must be frozen before Bootstrap claims a final system-package template.

Bootstrap may provide a default conventional package fixture, but it MUST describe it as the default non-ECS layout rather than the only allowed internal structure.

ADR-004 may authorize data-oriented/ECS-heavy internals while preserving:

- bounded system package ownership;
- public surfaces;
- architecture dependency direction;
- canonical authority rules;
- test/document obligations.

## Testing topology Bootstrap establishes

```text
colocated *.test.ts
  -> unit/domain/application/tooling tests

testkit/*
  -> reusable deterministic fixtures/helpers

tests/integration/
  -> repository/cross-package integration contracts

tests/browser/
  -> browser-only smoke/behavior

tests/journeys/
  -> created when real product journeys exist

tests/visual/
  -> created when real visual authority exists
```

Bootstrap SHOULD NOT create empty journey or visual suites merely to satisfy topology.

## Verification strategy during Bootstrap

Selective Verification for the final system graph is not yet trusted because the real graph is being created by Bootstrap itself.

Bootstrap therefore uses an intentionally conservative scaffold gate:

```text
focused tooling/package tests
  ↓
architecture boundary tests
  ↓
full scaffold lint/typecheck/unit/build
  ↓
minimal browser smoke
  ↓
exact-head CI
  ↓
clean-worktree evidence
```

After a real package topology exists, Selective Verification can be designed and validated against it.

## Acceptance gate

Foundation Bootstrap is complete only when the exact committed HEAD has evidence for at least:

```text
install from lockfile      PASS
format                     PASS
lint                       PASS
typecheck                  PASS
unit/tooling tests         PASS
architecture tests         PASS
build                      PASS
minimal browser smoke      PASS
clean worktree             PASS
exact-head CI              PASS
```

Full Browser verification is not a Bootstrap requirement because no real gameplay journey exists yet.

## Deliverables

Foundation Bootstrap should leave the repository with:

- working workspace/toolchain;
- minimal application shell;
- approved foundation packages only;
- explicit package export surfaces;
- architecture checks with fixture tests;
- query graph cycle detection;
- documentation templates/conventions;
- CI/local verification baseline;
- no gameplay implementation.

## Implementation gate

This document is a reviewed design baseline, not permission to implement immediately.

Implementation starts only after:

```text
ADR-002 FROZEN
ADR-003 FROZEN
ADR-004 FROZEN
Foundation Bootstrap specification reviewed
TDD implementation plan reviewed
```

## Final invariants

```text
Bootstrap implements architecture, not gameplay.
No empty speculative packages.
Every created foundation package has a governing decision.
Architecture rules are executable tests, not prose only.
The browser shell proves composition without becoming gameplay authority.
Old workflow principles may be restored/adapted; old topology assumptions may not.
Selective Verification is redesigned only after a real current graph exists.
Exact-head and clean-worktree evidence remain release discipline.
```