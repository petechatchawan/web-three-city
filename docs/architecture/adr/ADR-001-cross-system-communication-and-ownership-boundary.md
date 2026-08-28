# ADR-001 — Cross-System Communication and Ownership Boundary

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Product Architecture
- **Decision type:** Repository-wide architecture contract
- **Depends on:** ADR-000, Product Architecture, Product Architecture Blueprint

## Context

The Product Architecture requires gameplay systems to remain independently owned, testable, and resistant to hidden mutation chains.

Cross-system interaction therefore needs explicit semantics, enforceable package surfaces, and a clear classification rule for single-authority versus multi-authority behavior.

This ADR defines:

- Query semantics;
- Command semantics;
- Integration Event semantics;
- Cross-system orchestration;
- event ownership;
- package export permissions;
- bidirectional read/cycle policy;
- contract and port separation;
- command rejection conventions.

Persistence durability, concrete transaction mechanics, outbox/recovery behavior, replay metadata, and save/load coordination remain deferred to ADR-003. Runtime scheduling and determinism primitives remain governed by ADR-002.

## Decision

Cross-system communication has exactly four architectural forms:

1. **Query** — synchronous read of another system's public state.
2. **Command** — synchronous request to one owning system to perform a mutation that it may accept or reject.
3. **Integration Event** — immutable post-commit fact emitted by the system that owns the committed change and observed by zero or more consumers.
4. **Cross-system Orchestration** — application policy that coordinates commands across more than one mutation authority or another genuinely cross-system concern.

These are not interchangeable:

```text
Event != Command
Command != Event
Query != hidden Command
```

## Repository ownership layers

Canonical dependency direction:

```text
apps/*
  ↓
orchestration/*
  ↓
systems/* public APIs
  ↓
foundation/*
```

Normative rules:

- `foundation/*` MUST NOT depend on `systems/*`, `orchestration/*`, or `apps/*`.
- `systems/*` MUST NOT depend on `orchestration/*` or `apps/*`.
- `orchestration/*` MAY depend on public system read and command surfaces plus foundation contracts.
- `apps/*` MAY compose approved read, command, and composition surfaces but MUST NOT absorb hidden cross-system business policy.
- A system MUST NOT deep-import another system's domain, application, ports, presentation, tests, or implementation internals.
- Cross-package imports MUST resolve through declared package exports.

## Contract and port terminology

The repository uses these terms deliberately:

### Contracts

`contracts/*` contains types eligible for externally observable APIs, such as:

- queries;
- commands;
- integration-event types;
- DTOs;
- typed rejections.

A type under `contracts/*` is not public merely because it exists there. `package.json` exports define actual public authority.

### Ports

`ports/*` contains dependency-inversion interfaces required by implementation and is **internal by default**.

This repository usage differs from some classical Hexagonal Architecture terminology where “port” may also refer to public inbound interfaces.

Binding rule:

```text
Public read/command contract MUST NOT reference internal ports/* types.
```

A selected construction-only dependency interface MAY be exposed through a `./composition` surface when necessary for dependency injection, but MUST NOT leak into the read or command surface.

## System package surfaces

Each system package uses three semantic export surfaces when needed.

### Root read surface — `.`

Example:

```text
@web-three-city/roads
```

May expose:

- synchronous Query APIs;
- immutable/read-only DTOs;
- stable public value types;
- Integration Event types for subscribers/observers.

It MUST NOT expose mutation entrypoints.

### Mutation surface — `./commands`

Example:

```text
@web-three-city/roads/commands
```

May expose:

- Command types;
- intended mutation entrypoints;
- typed CommandResult/rejection contracts needed by callers.

Import permissions:

```text
systems/*       -> NO
orchestration/* -> YES
apps/*          -> YES
```

An app may invoke a single-system command from UI/application wiring. Coordinating more than one mutation authority still belongs in orchestration.

### Construction surface — `./composition`

Example:

```text
@web-three-city/roads/composition
```

May expose only construction and wiring capabilities such as:

- system factories;
- registration functions;
- construction-only dependency interfaces;
- adapter factories intended for the composition root.

Import permissions:

```text
systems/*       -> NO
orchestration/* -> NO
apps/*          -> YES
```

This is not a gameplay API.

## Foundation contract primitives

`foundation/contracts` provides repository-wide generic application-contract primitives and MUST NOT contain gameplay-specific semantics.

Canonical command result:

```ts
export interface CommandRejection {
  readonly code: string;
}

export type CommandResult<
  TValue,
  TRejection extends CommandRejection,
> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly rejection: TRejection;
    };
```

Canonical minimum Integration Event shape:

```ts
export interface IntegrationEvent<
  TType extends string,
  TPayload,
> {
  readonly type: TType;
  readonly payload: Readonly<TPayload>;
}
```

Event identity, persistence metadata, sequence metadata, durability, replay metadata, and delivery guarantees are intentionally deferred to ADR-003.

Expected business rejection MUST use typed rejection contracts rather than exceptions, `null`, `undefined`, strings, or bare booleans.

User-facing localization text does not belong in domain rejection contracts.

## Query semantics

A Query is a synchronous read through another system's root public surface.

A Query:

- MUST NOT mutate canonical state;
- MUST NOT publish Integration Events;
- MUST NOT hide deferred mutation;
- MAY use observationally transparent internal caches;
- MUST return immutable/read-only values, DTOs, or snapshots rather than mutable internal collections.

A use case may query multiple systems without automatically becoming orchestration. Classification is based on mutation-authority count, not query count.

No arbitrary query fan-out threshold is frozen. If fan-out becomes a maintenance or performance problem, evidence may justify a later policy.

## Acyclic direct-query dependency rule

Direct system-to-system package dependencies through root read surfaces MUST form an acyclic graph.

The graph is derived from workspace manifests and actual imports. A separately maintained manual graph is not authority.

Architecture verification MUST fail a direct dependency cycle.

### Bidirectional semantic reads

Two systems may legitimately need information from each other at the semantic level. This does **not** permit a package cycle.

If direct imports would create:

```text
A -> B
B -> A
```

one direction MUST be inverted.

Preferred pattern:

```text
System A application
  ↓ depends on
A-owned internal ReadPort
  ↑ implemented/wired by
apps/game composition adapter
  ↓ calls
System B root Query surface
```

System A therefore does not import System B for the inverted direction.

This remains a single-system use case when only System A mutates. It does not become orchestration merely because dependency inversion is used.

If the bridging adapter contains business sequencing/policy rather than trivial translation/wiring, the design must be reconsidered and may belong in an orchestration concern.

## Command semantics

A Command requests exactly one owning system to perform mutation.

A Command:

- has one target mutation authority;
- is handled at the target system's application boundary;
- validates expected business rules before canonical mutation;
- returns `CommandResult<TValue, TRejection>`;
- MUST NOT return Integration Events for the caller to publish;
- MAY throw only for programming defects, violated internal invariants, or infrastructure failures not modeled as expected business rejection.

A system application layer MUST NOT call another system's command surface.

If a use case needs to command a second mutation authority, the use case belongs in `orchestration/*`.

## Integration Event semantics

An Integration Event is an immutable fact describing canonical state that has already committed.

Examples:

```text
RoadBuilt
RoadRemoved
ZoneChanged
BuildingConstructed
HouseholdMoved
```

Non-examples:

```text
BuildRoadPlease
CalculateEconomyNow
UpdateEverything
```

An Integration Event:

- MUST use an explicit stable discriminator;
- MUST carry immutable serializable payload data where appropriate;
- MUST NOT expose mutable domain objects;
- MUST NOT be used as request/response RPC;
- MUST NOT require the publisher to know its subscribers;
- MAY have zero, one, or many subscribers.

Correlation-id plus response-event RPC is not an acceptable substitute for a Command API.

## Event ownership and post-commit rule

The system that owns the mutation also owns creation, collection, and dispatch initiation for Integration Events describing that mutation.

Canonical lifecycle:

```text
Command / scheduled owned work
  ↓
Validate
  ↓
Canonical mutation
  ↓
COMMIT
  ↓
Owning system finalizes committed Integration Events
  ↓
Owning system hands events to dispatcher
  ↓
0..N subscribers
```

The caller, UI, and orchestrator MUST NOT be responsible for remembering to publish another system's events.

No Integration Event may become externally observable before the canonical change it describes has committed.

Concrete collection and durability mechanisms — event sink, unit of work, transaction envelope, outbox, retry/recovery, or equivalent — are governed by ADR-003.

Once canonical commit succeeds, post-commit delivery failure MUST NOT retroactively make the originating command appear rejected or rolled back.

Subscriber failure is distinct from business rejection.

## Event bus responsibility

`foundation/event-bus` is a typed Integration Event delivery capability.

It is explicitly not:

- a gameplay workflow engine;
- a global mutable state store;
- a universal command dispatcher;
- a transaction coordinator;
- a service locator / DI container;
- canonical simulation scheduling authority.

Domain code MUST NOT publish or subscribe to the concrete event bus directly.

ADR-002 MUST preserve explicit ordered simulation scheduling rather than use event subscriber order as gameplay execution order.

## Single-system versus cross-system use cases

The threshold is the number of canonical mutation authorities commanded by the use case.

### Exactly one mutation authority

The use case belongs to the owning system's application boundary even if it queries multiple other systems.

Example:

```text
BuildRoad
  query Terrain buildability
  query Zoning occupancy
  mutate Roads only
```

This is a Roads application use case.

If direct read dependencies would create a cycle, dependency inversion is used as described above; the use case does not automatically move to orchestration.

### More than one mutation authority

The use case belongs to an orchestration concern.

Example:

```text
PurchaseAndBuildRoad
  command Economy
  command Roads
```

The orchestrator owns application-level sequencing, result composition, and the transaction/compensation policy required by ADR-003.

## Orchestration namespace

`orchestration/` is a top-level namespace, not one monolithic package.

Possible concerns include:

```text
orchestration/gameplay/
orchestration/persistence/
orchestration/import-export/
orchestration/diagnostics/
```

Only concerns justified by actual behavior are created.

`orchestration/gameplay` MUST NOT become a generic dumping ground for application code.

Save/load coordination, if needed, belongs to persistence-specific orchestration rather than gameplay orchestration.

`apps/game` wires orchestrators but does not absorb their business policy.

## Cross-system transaction boundary

ADR-001 does not prescribe one global transaction mechanism.

It freezes these constraints:

- a single-system command owns its single-authority atomic mutation boundary;
- multi-system orchestration makes sequencing/failure behavior explicit;
- multi-system atomicity MUST NOT be simulated by abusing the event bus;
- Integration Events remain post-commit facts;
- ADR-003 transaction/persistence mechanisms MUST preserve owning-system authority and event ownership.

## Public contract design

Cross-system contracts SHOULD be small, immutable, intention-revealing, and serializable where persistence/delivery requires it.

Public read/command contracts MUST NOT leak:

- Three.js objects;
- DOM objects;
- mutable internal collections;
- private entity/service implementations;
- implementation caches;
- internal `ports/*` types.

A composition-only export may expose narrowly scoped construction dependency interfaces but those MUST remain isolated to `./composition`.

Until a dedicated contract-evolution policy exists, a breaking monorepo contract change updates the owner and all affected consumers atomically and updates contract verification in the same change.

The legacy static verification map is not the current dependency graph.

## Contract testing

Every exported cross-system contract requires first-class automated verification appropriate to the surface.

Required categories include:

- CommandResult success/rejection semantics;
- Query DTO shape and semantics;
- Integration Event discriminator/payload contract tests;
- package export-boundary tests;
- architecture import-boundary tests;
- cycle detection for direct system Query dependencies.

Snapshot tests may assist but MUST NOT be the only semantic assertion where explicit assertions are clearer.

## Architecture enforcement

Foundation Bootstrap must implement automated checks rejecting at least:

```text
foundation/* -> systems/*
foundation/* -> orchestration/*
foundation/* -> apps/*

systems/* -> orchestration/*
systems/* -> apps/*

systems/A -> systems/B/commands
systems/A -> systems/B/composition
orchestration/* -> systems/*/composition

cross-package deep filesystem import
public read/command contract -> internal ports/* type
direct system Query dependency cycle
system domain -> Three.js
system domain -> DOM/browser API
system domain -> concrete event-bus implementation
undeclared package public import
```

Allowed surface matrix:

```text
Consumer          system "."    system "./commands"    system "./composition"
-------------------------------------------------------------------------------
systems/*              YES              NO                      NO
orchestration/*        YES              YES                     NO
apps/*                 YES              YES                     YES
```

Architecture checks must run in the fast development/owner loop, not only a final repository release gate.

## Failure semantics

Expected business rejection is typed `CommandResult` rejection.

Infrastructure and programming failures are separate failure classes.

Rules:

- UI MUST NOT infer business meaning from exception strings;
- orchestrators handle each commanded system's typed rejection explicitly;
- subscriber failure MUST NOT alter a committed command's business meaning;
- hidden best-effort cross-system mutation from an event subscriber is forbidden where caller correctness depends on success;
- correctness-sensitive cross-system mutation must be explicit orchestration or a separately approved eventually-consistent process.

## Forbidden patterns

Architecture violations include:

- deep-importing another system's internals;
- one system importing another system's `./commands` surface;
- one system importing another system's `./composition` surface;
- orchestration importing a system's `./composition` surface;
- public read/command contracts referencing internal port types;
- direct cyclic Query package dependencies;
- using events as commands/RPC;
- returning Integration Events in CommandResult for caller publication;
- publishing events before commit;
- letting domain code know the concrete event bus;
- hiding mutation inside Query;
- placing multi-authority gameplay orchestration in `apps/game`;
- placing gameplay-specific orchestration in `foundation/*`;
- using event delivery order as simulation scheduling order;
- using the legacy static verification map as current architecture authority.

## Consequences

Benefits:

- ownership and mutation authority remain explicit;
- Query, Command, Event, and Orchestration are mechanically distinguishable;
- command prohibition between systems becomes enforceable through package surfaces;
- cyclic semantic reads can be supported without cyclic package imports;
- callers cannot omit or duplicate another system's event publication;
- systems remain independently testable;
- composition wiring is available without exposing implementation internals as gameplay APIs.

Accepted costs:

- system packages maintain multiple deliberate export surfaces;
- dependency inversion is required when direct read edges would cycle;
- orchestration is required for multi-authority mutation;
- event durability still requires ADR-003;
- public-surface discipline requires architecture tooling/tests.

## Foundation Bootstrap requirements

Foundation Bootstrap must eventually:

1. create `foundation/contracts` with canonical generic result/event primitives;
2. create `foundation/event-bus` only after ADR-003 defines required delivery/durability semantics beyond ADR-001;
3. establish the system read/command/composition export convention;
4. implement architecture checks for the permission matrix and deep imports;
5. implement auto-derived direct Query graph cycle detection;
6. test public-contract-to-port leak prevention;
7. keep architecture checks in the fast verification path;
8. avoid importing former package-topology assumptions without explicit current decisions.

## Follow-up decisions

```text
ADR-002  Simulation Runtime, Scheduler, and Determinism Primitives
ADR-003  Persistence, Transaction, Event Delivery, and Save Ownership
ADR-004  Data-Oriented Domain and ECS Boundary
ADR-005  Selective Verification (planned after real package topology exists)
```

ADR-004 may change a system's internal organization but MUST preserve the public surface, ownership, and cross-system rules frozen here.

## Final invariants

```text
One canonical mutation -> one owning system.
Read another system -> root Query surface.
Ask one system to mutate -> Command.
Need to mutate another authority too -> orchestration/*.
Announce committed fact -> Integration Event.
Systems never import another system's command or composition surface.
Direct Query package graph is acyclic.
Bidirectional semantic read uses dependency inversion, not cyclic imports.
The owning system owns its committed Integration Events.
The caller never publishes another system's events.
The event bus transports facts; it does not run workflows or simulation order.
apps/game composes; it does not become the hidden cross-system business layer.
foundation stays below gameplay and never depends upward.
```