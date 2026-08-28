# Foundation Structure

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Foundation classification, package-creation gates, dependency direction, and reserved capability homes
- **Depends on:** Product Architecture, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A6 Public Export & Dependency Rules
- **Sequence:** A8 — Foundation Structure

## 1. Purpose

`foundation/*` contains generic lower-level capabilities with no gameplay ownership.

Core rule:

```text
Shared usage does not make something Foundation.
Foundation requires stable generic semantics with no gameplay ownership.
```

Foundation exists to reduce accidental coupling to unstable product-specific concepts, not to provide a universal shared-code bucket.

## 2. Foundation qualification test

A capability may enter `foundation/*` only when all of these are true:

```text
1. It has no gameplay ownership.
2. It can be described without product-domain vocabulary.
3. Its semantics are stable enough to support multiple owners.
4. Its dependency direction points downward, not toward systems/apps/orchestration.
5. Its reuse is semantic, not merely code similarity.
6. It has a coherent bounded infrastructure/primitive purpose.
7. It has an approved governing architecture decision/specification.
```

Failure of any item means the capability remains with its current owner or is not created yet.

## 3. Foundation anti-vocabulary rule

Foundation must not gain gameplay semantics by aggregation.

Forbidden examples while they retain gameplay meaning:

```text
Money
RoadId
ZoneType
BuildingId
HouseholdId
TrafficDemand
RoadGrade
BuildingFootprint
```

A type used by many systems still belongs to the concept owner when its meaning is domain-specific.

Generic words can still hide gameplay ownership; reviewers judge semantics, not naming tricks.

## 4. Reserved capability homes

A8 reserves the following conceptual homes so future architecture has predictable placement, but **reservation is not package-creation approval**:

```text
foundation/contracts
foundation/deterministic
foundation/runtime
foundation/event-bus
foundation/persistence
foundation/spatial
```

A reserved home may remain absent until its governing decision is frozen and real code is required.

No empty directory/package is created merely because the name is reserved.

## 5. `foundation/contracts`

Purpose:

```text
generic repository-wide contract primitives
```

Current governing authority: ADR-001.

Examples currently justified in principle:

```text
CommandResult generic shape
CommandRejection base shape
minimum IntegrationEvent generic shape
```

It must not contain system-specific commands, IDs, DTOs, rejection codes, or event discriminators.

`foundation/contracts` is the only reserved Foundation package currently governed enough to be a candidate for initial Bootstrap creation, and only when the scaffold needs it.

## 6. `foundation/deterministic`

Reserved for generic determinism primitives only.

Potential examples may include:

```text
seeded deterministic random abstraction
stable ordering helpers
deterministic numeric primitives
```

Creation is blocked until the determinism/runtime architecture is approved.

It must not define gameplay scheduling, calendar semantics, economy randomness, traffic policy, or system-specific seeds.

## 7. `foundation/runtime`

Reserved for product-neutral runtime primitives whose ownership is below gameplay systems.

Potential responsibilities may include generic lifecycle/scheduling contracts once approved.

Creation is blocked until runtime/scheduler architecture is frozen.

`foundation/runtime` must not become a global application service layer or a place for game rules merely because many systems run through it.

## 8. `foundation/event-bus`

Reserved for generic Integration Event delivery infrastructure.

Creation is blocked until event delivery/durability semantics are frozen.

It must remain transport/delivery infrastructure and must not become:

```text
Command bus
gameplay workflow engine
transaction coordinator
simulation scheduler
global mutable store
service locator
```

## 9. `foundation/persistence`

Reserved for generic persistence infrastructure/contracts after transaction/save ownership is designed.

Creation is blocked until persistence architecture is frozen.

It must not absorb gameplay save schemas or system-owned canonical state definitions.

Systems own the semantics of what their canonical state means; Foundation may later provide generic storage/versioning primitives.

## 10. `foundation/spatial`

Reserved for generic spatial primitives only if current World/Spatial architecture proves a product-neutral semantic core.

Creation is blocked until spatial architecture is frozen.

Examples that might qualify only after design include generic coordinates/transforms/index primitives. Gameplay concepts such as a Terrain gameplay cell, Road segment, Zone parcel, or building lot do not automatically qualify.

## 11. New Foundation capability creation

A new `foundation/<capability>` outside the reserved set requires an explicit architecture decision answering:

```text
What generic capability does it own?
Why is it Foundation rather than system/app/tooling/testkit?
Which current consumers require it?
What gameplay vocabulary is explicitly excluded?
What lower-level dependencies does it require?
Which document governs its semantics?
Why is local duplication or owner-local implementation worse than promotion?
```

If the main argument is "many packages need this helper", creation is rejected.

## 12. Default Foundation package shape

Foundation packages do not copy the gameplay-system internal template by default.

Minimal default:

```text
foundation/<capability>/
├─ package.json
├─ src/
└─ tests/
```

Internal folders are capability-specific and created only when semantically useful.

Possible internal distinctions such as contracts, implementation, adapters, or composition may be introduced when the capability requires them, but there is no mandatory `domain/application/presentation` ceremony.

## 13. Foundation public surfaces

A6 rules apply.

Default:

```text
"."              stable generic capability
"./composition"  optional construction wiring when externally needed
```

Foundation does not expose system-style `./commands` unless a future approved architecture decision introduces a non-gameplay mutation concept that truly requires such semantics; that is not part of the current model.

Public Foundation surface expansion is conservative because lower-level packages can accumulate many consumers.

## 14. Foundation dependency direction

Binding rule:

```text
foundation/* -> systems/*        FORBIDDEN
foundation/* -> orchestration/*  FORBIDDEN
foundation/* -> apps/*           FORBIDDEN
foundation/* -> testkit/*        FORBIDDEN
foundation/* -> tooling/*        FORBIDDEN
```

Foundation may depend on other Foundation packages only through explicit public APIs and declared dependencies.

The Foundation package graph must remain acyclic.

## 15. Foundation layering without formal tiers

A8 does not introduce fixed numerical Foundation layers.

Instead:

```text
actual package dependencies define the lower-level graph
```

A package should depend only on capabilities semantically below it.

If two Foundation capabilities require bidirectional dependency, ownership/separation is likely wrong and must be redesigned rather than permitting a cycle.

## 16. Foundation and third-party libraries

Foundation may wrap or expose a generic third-party capability when doing so creates a stable repository-owned abstraction with real value.

It must not create wrappers merely to hide every external package name.

Review questions:

```text
Does the abstraction own stable semantics?
Will multiple owners depend on those semantics rather than the vendor API?
Can the vendor implementation change behind the boundary?
Is this abstraction genuinely product-neutral?
```

A thin one-to-one wrapper with no semantic benefit is not automatically Foundation-worthy.

## 17. Foundation values and IDs

Generic technical identifiers may belong in Foundation only when their semantics are genuinely generic.

Gameplay identities follow concept ownership under A4:

```text
RoadId       -> Roads
BuildingId   -> Buildings
HouseholdId  -> Households
```

Do not centralize IDs into `foundation/ids` merely to avoid imports.

If importing an owner ID creates an undesirable graph edge, solve the dependency design rather than moving ownership to Foundation.

## 18. Foundation state

Foundation may own infrastructure state required to implement its generic capability, but such state is not gameplay canonical authority.

Examples might later include internal event-delivery queues or runtime registry structures once governed.

Foundation must not become the owner of gameplay truth simply because it stores bytes/records for systems.

```text
storage possession != semantic ownership
```

## 19. Foundation error contracts

Generic Foundation failures should remain infrastructure/technical semantics unless a capability explicitly defines a stable generic rejection contract.

Gameplay business rejection codes remain with owning systems/orchestrations.

Do not normalize every domain error into a giant shared Foundation error enum.

## 20. Foundation testing

Foundation package unit/contract tests are package-owned.

Cross-package tests use public Foundation exports under A4/A9.

Because Foundation packages can have high fan-in, contract tests should emphasize semantic stability and independence from consumers.

## 21. Promotion and demotion lifecycle

### Promotion into Foundation

Requires evidence that a capability has become generic and semantically stable.

Promotion should move ownership deliberately; it is not a copy-paste extraction.

### Demotion out of Foundation

If a capability accumulates gameplay vocabulary or becomes specific to one owner, reconsider ownership rather than preserving Foundation placement for compatibility convenience.

Current monorepo consumers can be migrated atomically under the current contract-change policy.

## 22. Anti-pattern checklist

- [ ] capability enters Foundation because two packages contain similar code;
- [ ] gameplay ID/type is centralized into Foundation to avoid dependency edges;
- [ ] Foundation package is created before its governing design exists;
- [ ] reserved conceptual home is treated as mandatory empty package;
- [ ] Foundation imports a system/orchestration/app;
- [ ] Foundation graph contains a cycle;
- [ ] `foundation/runtime` becomes global application/gameplay logic;
- [ ] `foundation/event-bus` becomes command bus/workflow engine/scheduler;
- [ ] `foundation/persistence` owns gameplay save semantics;
- [ ] generic error package absorbs gameplay rejections;
- [ ] third-party wrapper is created with no stable abstraction value;
- [ ] Foundation package copies system `domain/application/presentation` folders ceremonially;
- [ ] infrastructure storage is mistaken for gameplay authority.

## 23. Definition of Done examples

```text
generic CommandResult<T, R>
-> foundation/contracts candidate governed by ADR-001

RoadId
-> systems/roads, not Foundation

Money
-> gameplay owner, not Foundation merely because widely used

seeded random primitive
-> foundation/deterministic candidate only after determinism architecture

simulation phase policy
-> not approved for Foundation until runtime architecture defines semantics

generic event transport
-> foundation/event-bus candidate after delivery architecture

RoadBuilt event payload
-> Roads contract, not foundation/event-bus

IndexedDB adapter primitives
-> possible persistence infrastructure after A8 + persistence architecture, not gameplay save authority
```

## 24. Creation gate matrix

```text
Capability                    Current structural status
------------------------------------------------------
foundation/contracts          RESERVED; candidate after A8 review because ADR-001 governs core primitives
foundation/deterministic      RESERVED; BLOCKED by runtime/determinism architecture
foundation/runtime            RESERVED; BLOCKED by runtime/scheduler architecture
foundation/event-bus          RESERVED; BLOCKED by event delivery/persistence architecture
foundation/persistence        RESERVED; BLOCKED by persistence/transaction architecture
foundation/spatial            RESERVED; BLOCKED by World/Spatial architecture
```

This matrix is a design guard, not an instruction to create packages now.

## 25. Deferred decisions

A8 intentionally does not freeze:

```text
runtime/scheduler semantics
deterministic RNG semantics
event delivery guarantees
transaction/outbox mechanics
save schema/versioning
World/Spatial primitives
third-party persistence implementation
```

## 26. Final invariants

```text
Foundation is product-neutral lower-level capability ownership.
Shared use != Foundation.
Semantic reuse, not code similarity, justifies promotion.
Gameplay vocabulary/identity stays with gameplay owner.
Reserved home != package-creation approval.
No empty speculative Foundation packages.
Foundation does not depend upward.
Foundation dependency graph is acyclic.
Foundation public APIs remain conservative.
Foundation packages use capability-specific internals, not ceremonial system layers.
Infrastructure state/storage does not become gameplay canonical authority.
Every Foundation package requires a governing current architecture decision.
```