# ADR-001 — Cross-System Communication and Ownership Boundary

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Product Architecture v2
- **Decision type:** Repository-wide architecture contract

## 1. Context

Product Architecture v2 resets gameplay architecture while retaining the repository, Git history, toolchain, and verification discipline. The reset must prevent direct package coupling, hidden mutation, and implicit cross-system workflows from reappearing under new names.

Every gameplay system therefore needs one explicit ownership boundary and one explicit public surface. Cross-system interaction must communicate intent and facts without exposing another system's domain or application internals.

This ADR defines the canonical semantics for queries, commands, integration events, and cross-system orchestration. It also assigns integration-event ownership and standardizes command rejection.

Event durability, save transaction mechanics, outbox/recovery implementation, and replay storage are deferred to ADR-003. ADR-003 must preserve the ownership rules frozen here.

## 2. Decision

Cross-system communication has exactly four architectural forms:

1. **Query** — synchronous read of another system's public state.
2. **Command** — synchronous request to one owning system to perform a mutation that it may accept or reject.
3. **Integration Event** — immutable post-commit fact emitted by the system that owns the committed change and observed by zero or more consumers.
4. **Cross-system Orchestration** — application policy that coordinates commands across more than one mutation authority.

These forms are not interchangeable:

```text
Event != Command
Command != Event
Query != hidden Command
```

## 3. Repository Ownership Layers

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
- `orchestration/*` MAY depend on public system APIs and foundation contracts.
- `apps/game` MAY depend on orchestration packages and public composition APIs, but MUST NOT own cross-system business use-case logic.
- A system MUST NOT import another system's internal `domain`, `application`, implementation-only `ports`, tests, or presentation internals.
- Cross-system imports MUST go through the target package's declared public export surface.
- A system MAY query another system through its public query contract.
- A system MUST NOT command another system directly. If a use case needs to command a second mutation authority, the use case MUST move to `orchestration/*`.

For PR0, the canonical public surface is the package root `index.ts` plus its matching `package.json` export. Additional public subpath exports require an explicit architecture decision.

## 4. System Internal Layers

A gameplay system uses this conceptual structure:

```text
systems/<name>/
  src/
    domain/
    application/
    ports/
    contracts/
    presentation/
    index.ts
```

Responsibilities:

- `domain/` owns pure gameplay rules and canonical domain behavior.
- `application/` owns single-system use cases and invokes domain behavior and ports.
- `ports/` contains explicit interfaces required by the application boundary.
- `contracts/` contains public DTOs, query/command contracts, integration-event contracts, and rejection types.
- `presentation/` adapts canonical state to Three.js or another presentation technology and MUST NOT own gameplay authority.

The domain layer MUST NOT publish or subscribe to the repository event bus directly.

## 5. Foundation Contract Primitives

PR0 SHALL provide `foundation/contracts` for repository-wide generic application-contract primitives. It MUST NOT contain gameplay-specific semantics.

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

Canonical minimum integration-event shape:

```ts
export interface IntegrationEvent<
  TType extends string,
  TPayload,
> {
  readonly type: TType;
  readonly payload: Readonly<TPayload>;
}
```

Event identity, persistence metadata, sequence metadata, durability, and replay metadata are deliberately not frozen here; ADR-002/003 may extend the envelope without changing the semantic distinction between command and event.

Gameplay systems specialize rejection types with discriminated unions. Example:

```ts
export type BuildRoadRejection =
  | {
      readonly code: "terrain-not-buildable";
      readonly cell: CellCoord;
    }
  | {
      readonly code: "occupied";
      readonly cell: CellCoord;
    }
  | {
      readonly code: "insufficient-funds";
      readonly required: Money;
      readonly available: Money;
    };
```

User-facing messages and localization text MUST NOT be embedded in domain rejection contracts. Presentation maps rejection codes to UX behavior.

## 6. Query Semantics

A query is a synchronous read through the target system's public API.

A query:

- MUST NOT mutate canonical state;
- MUST NOT publish integration events;
- MUST NOT hide deferred gameplay mutation;
- MAY maintain observationally transparent internal caches;
- MUST return explicit immutable/read-only DTOs, values, or snapshots rather than expose mutable internal collections.

A use case may query any number of systems without automatically becoming cross-system orchestration. The classification threshold is mutation authority count, not query count.

Cross-system query dependencies MUST remain acyclic.

## 7. Command Semantics

A command requests exactly one owning system to perform a mutation.

A command:

- has exactly one target mutation authority;
- is handled by the target system's application boundary;
- validates before canonical mutation;
- returns `CommandResult<TValue, TRejection>`;
- MUST NOT communicate expected business rejection through `throw`, `null`, `undefined`, or a bare boolean;
- MAY throw only for programming defects, violated internal invariants, or infrastructure failures that cannot be represented as expected business rejection.

A successful command result describes the requested operation result. It does **not** carry integration events for the caller to publish.

A system application layer MUST NOT call another system's command API. Requiring a second system command is the hard signal that the use case belongs in orchestration.

## 8. Integration Event Semantics

An integration event is an immutable fact describing a canonical change that has already committed.

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

An integration event:

- MUST use an explicit stable discriminator;
- MUST use immutable serializable payload data;
- MUST NOT expose mutable domain objects;
- MUST NOT be used as request/response RPC;
- MUST NOT require the publisher to know its subscribers;
- MAY have zero, one, or many subscribers.

## 9. Event Ownership and Post-Commit Rule

The system that owns the command and canonical mutation also owns creation, collection, and dispatch initiation for integration events describing that mutation.

Normative lifecycle:

```text
Command
  ↓
Validate
  ↓
Canonical mutation
  ↓
COMMIT
  ↓
Owning system finalizes committed integration events
  ↓
Owning system hands committed events to dispatcher
  ↓
0..N subscribers
```

The caller, UI, and cross-system orchestrator MUST NOT be responsible for remembering to publish another system's integration events.

An event MUST NOT become externally observable before its associated canonical state is committed.

The exact collection mechanism — event sink, transaction envelope, unit of work, outbox, or equivalent — is deferred to ADR-003. ADR-003 MUST preserve owning-system responsibility.

Once canonical commit succeeds, post-commit delivery failure MUST NOT make the originating command appear rejected or rolled back. Subscriber exceptions MUST be isolated from business rejection semantics and reported through an explicit delivery/health/recovery path. Durability, retry, recovery, and failure-recording behavior are owned by ADR-003.

## 10. Event Bus Responsibility

`foundation/event-bus` is a typed integration-event delivery mechanism.

It is explicitly **not**:

- a gameplay workflow engine;
- a global mutable state container;
- a universal command dispatcher;
- a transaction coordinator;
- a service locator or dependency-injection container.

Domain code MUST NOT depend directly on the event bus. Event dispatch and subscription belong at application/runtime adapter boundaries.

## 11. Single-System vs Cross-System Use Cases

The classification threshold is the number of canonical mutation authorities commanded by the use case.

### Single-system use case

If a use case commands **exactly one** system mutation authority, it remains owned by that system's `application/` layer regardless of how many other systems it queries.

Example:

```text
BuildRoad
  query Terrain buildability
  query Zoning occupancy
  command Roads
```

This remains a Roads application use case because only Roads mutates.

Its cross-system dependencies are read-only public query contracts and MUST preserve an acyclic graph.

### Cross-system use case

If a use case needs commands that mutate **more than one** system authority, it MUST live under the appropriate `orchestration/*` concern package.

Example:

```text
PurchaseAndBuildRoad
  command Economy debit funds
  command Roads build road
```

This belongs in orchestration because it coordinates two mutation authorities and owns application-level sequencing, compensation/atomicity requirements, and result composition.

A use case MUST NOT be moved into orchestration merely because it performs multiple read-only queries.

## 12. Orchestration Namespace

`orchestration/` is a top-level architectural namespace, not one monolithic package.

Possible concern packages include:

```text
orchestration/
  gameplay/
  persistence/
  import-export/
  diagnostics/
```

Only packages justified by an actual cross-system concern should be created. PR0 MUST NOT create empty concern packages for speculative future needs.

`orchestration/gameplay` owns cross-system gameplay application policy. It MUST NOT become a generic dumping ground for all application behavior.

Save/load orchestration, if required by ADR-003, belongs to a persistence-specific orchestration concern rather than `orchestration/gameplay`.

`apps/game` wires dependencies into orchestrators but does not absorb orchestration logic.

## 13. Cross-System Transaction Boundary

ADR-001 does not prescribe one global transaction mechanism.

It freezes these constraints:

- a single-system command owns its own atomic mutation boundary;
- a multi-system orchestrator MUST make sequencing and failure behavior explicit;
- multi-system atomicity MUST NOT be simulated by abusing the event bus;
- integration events remain post-commit facts;
- transaction/persistence mechanisms defined later MUST preserve system ownership and event ownership.

ADR-003 owns the concrete transaction and persistence design.

## 14. Public Contract Design and Compatibility

Cross-system contracts SHOULD be small, immutable, serializable where appropriate, and intention-revealing.

Public contracts MUST NOT leak:

- Three.js objects;
- DOM objects;
- mutable internal collections;
- private entity/service implementations;
- implementation-specific caches.

A public command/query/event/DTO change is an observable contract change. Such a change MUST:

1. identify affected consumers;
2. update verification-map or affected-graph metadata when dependency relationships change;
3. update contract tests in the same PR;
4. update owning system documentation;
5. explicitly address persistence/replay compatibility when save/replay facing.

The Product Architecture v2 dependency graph is derived from v2 package manifests and public contracts. The legacy static Level 2 verification chain is not architectural authority for v2.

## 15. Contract Testing

Every exported cross-system contract requires first-class automated verification.

Required categories:

- command-result success/rejection tests;
- public query DTO shape and semantic tests;
- integration-event discriminator/payload contract tests;
- package export-boundary tests;
- architecture import-boundary tests.

Snapshot tests MAY be used where useful but MUST NOT be the only semantic assertion when structural or behavioral assertions are clearer.

Contract tests belong with the owning system and run as part of Level 1 owner verification. Public changes additionally trigger affected-consumer verification.

## 16. Architecture Enforcement

PR0 SHALL add automated boundary checks rejecting at least:

```text
foundation/* → systems/*
foundation/* → orchestration/*
foundation/* → apps/*

systems/* → orchestration/*
systems/* → apps/*

system A → system B internal paths
system A → system B command API
system domain → foundation/event-bus
system domain → Three.js
system domain → DOM/browser APIs
```

Allowed cross-system dependency from one system package to another is read-only public query contract access only.

PR0 SHALL also enforce that cross-system imports resolve through declared package exports rather than filesystem-relative deep imports.

Boundary verification MUST participate in the fast owner/development loop, not only the final repository-wide gate.

## 17. Failure Semantics

Expected business rejection is represented by typed `CommandResult` rejection unions.

Infrastructure and programming failures are distinct from business rejection.

Rules:

- UI MUST NOT infer rejection meaning from exception-message strings.
- An orchestrator MUST handle each commanded system's typed rejection explicitly.
- Subscriber failure MUST NOT alter the meaning of an originating command after its canonical mutation committed.
- A dispatcher MUST prevent subscriber failure from making an already committed command appear rolled back or normally rejected.
- Hidden best-effort cross-system mutation from an event subscriber is forbidden when correctness requires the caller to know whether that mutation succeeded. Such behavior must be explicit orchestration or a separately documented eventually consistent process.

## 18. Examples

Single-authority Roads use case:

```text
UI
 ↓
Roads public API
 ↓
Roads application use case
 ├─ Terrain public Query
 ├─ Zoning public Query
 └─ Roads domain mutation
         ↓
       COMMIT
         ↓
      RoadBuilt
         ↓
 foundation/event-bus
    ├─ cache/projection invalidation
    └─ presentation synchronization
```

Multi-authority gameplay use case:

```text
UI
 ↓
orchestration/gameplay
 ├─ Economy Command
 └─ Roads Command
       ↓
explicit sequencing / transaction policy
       ↓
each owning system commits its authority
and owns its post-commit integration events
```

## 19. Forbidden Patterns

Architecture violations include:

- deep-importing another system's domain/application implementation;
- one system directly commanding another system;
- using events as commands to obtain request/response behavior;
- correlation-id plus response-event RPC as a substitute for a command port;
- returning another system's events in `CommandResult` for the caller to publish;
- publishing an integration event before canonical commit;
- letting domain code know about the event bus;
- hiding gameplay mutation inside a query;
- placing multi-authority gameplay orchestration in `apps/game`;
- placing gameplay-specific orchestration in `foundation/*`;
- treating `orchestration/gameplay` as the only orchestration concern;
- using the event bus as a transaction coordinator;
- treating the legacy static Level 2 map as the v2 dependency graph.

## 20. Consequences and Trade-offs

Benefits:

- system ownership remains explicit;
- command rejection is type-safe and consistent;
- systems cannot create command chains across authority boundaries;
- event consumers cannot control command success semantics;
- callers cannot omit or duplicate another system's event publication;
- multi-system mutation policy has one visible home outside `apps/game`;
- systems remain independently testable without booting the full game;
- event-driven coupling is constrained to post-commit facts rather than hidden RPC.

Accepted costs:

- public ports/contracts require deliberate maintenance;
- read-only query dependencies can still form undesirable cycles unless enforced;
- multi-authority use cases require an orchestration boundary;
- post-commit event durability requires ADR-003.

## 21. PR0 Enforcement Requirements

PR0 Product Architecture v2 Bootstrap MUST:

1. create `foundation/contracts` with canonical command/rejection/event primitives;
2. create `foundation/event-bus` with typed integration-event transport contracts only;
3. establish the top-level `orchestration/` namespace and create only concern packages required by real PR0 behavior;
4. establish the system package public-export convention;
5. add architecture tests for dependency direction, deep-import prevention, and the system-to-system command prohibition;
6. add representative contract tests for typed command rejection and integration-event shapes;
7. run architecture-boundary tests in the fast development/owner verification loop;
8. document how new systems register affected consumers in the v2 verification topology;
9. avoid importing legacy package dependency assumptions into the v2 graph without a new explicit decision.

## 22. Follow-up ADRs

```text
ADR-002  SimClock + Deterministic Simulation Scheduler
ADR-003  Persistence / Transaction / Save Ownership
ADR-004  Data-Oriented Domain / ECS Boundary
PR0      Product Architecture v2 Bootstrap
```

ADR-002 MUST preserve explicit ordered scheduling rather than use pub/sub delivery order as simulation order.

ADR-003 MUST preserve owning-system event collection/dispatch responsibility while defining concrete commit, durability, outbox/recovery, and save transaction mechanisms.

ADR-004 MUST preserve these public communication boundaries regardless of internal OOP, data-oriented, SoA, or ECS implementation choices.

## Final Invariants

```text
One canonical mutation → one owning system.

Read another system → Query.
Ask one system to mutate → Command.
Need to mutate a second system → orchestration/*.
Announce an already committed fact → Integration Event.

A system may query another system; it may not command it.
The owning system owns its committed integration events.
The caller never publishes another system's events.
The event bus transports facts; it does not run workflows.
apps/game composes; it does not become the business-use-case layer.
foundation stays below gameplay and never depends upward.
```