# ADR-001 — Cross-System Communication and Ownership Boundary

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Product Architecture v2
- **Decision type:** Repository-wide architecture contract

## 1. Context

Product Architecture v2 resets gameplay architecture while retaining the existing repository, toolchain, verification discipline, and Git history. The previous architecture accumulated direct package coupling and implicit cross-system behavior. The reset must prevent the same failure mode from reappearing under different names.

Every gameplay system therefore needs one explicit ownership boundary and one explicit public surface. Cross-system interaction must communicate intent and facts without allowing callers to reach into another system's domain or application internals.

This ADR defines the canonical semantics for queries, commands, integration events, and cross-system orchestration. It also defines where orchestration lives, who owns integration-event collection and dispatch, and how command rejection is represented.

This ADR does **not** define event durability, save transaction mechanics, outbox implementation, replay storage, or distributed delivery. Those are deferred to ADR-003. It does define the ownership constraints that ADR-003 must preserve.

## 2. Decision

Cross-system communication has exactly four architectural forms:

1. **Query** — synchronous read of another system's public state.
2. **Command** — synchronous request to one owning system to perform a mutation that it may accept or reject.
3. **Integration Event** — immutable post-commit fact emitted by the system that owns the committed change and observed by zero or more consumers.
4. **Cross-system Orchestration** — application policy that coordinates commands across more than one mutation authority.

The forms are not interchangeable:

```text
Event != Command
Command != Event
Query != hidden Command
```

The repository must enforce these distinctions structurally and through tests.

## 3. Repository Ownership Layers

The Product Architecture v2 dependency direction is:

```text
apps/*
  ↓
orchestration/*
  ↓
systems/* public APIs
  ↓
foundation/*
```

Normative dependency rules:

- `foundation/*` MUST NOT depend on `systems/*`, `orchestration/*`, or `apps/*`.
- `systems/*` MUST NOT depend on `orchestration/*` or `apps/*`.
- `orchestration/*` MAY depend on public system APIs and foundation contracts.
- `apps/game` MAY depend on orchestration packages and public composition APIs, but MUST NOT own cross-system business use-case logic.
- A system MUST NOT import another system's internal `domain`, `application`, implementation-only `ports`, tests, or presentation internals.
- Cross-system imports MUST go through the target package's declared public export surface.

For PR0, the canonical public surface is the package root `index.ts` plus its matching `package.json` export. Additional public subpath exports require an explicit architecture decision.

## 4. System Internal Layers

A gameplay system uses the following conceptual structure:

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
- `contracts/` contains public DTOs, command/query contracts, integration-event contracts, and rejection types exported across system boundaries.
- `presentation/` adapts canonical state to Three.js or other presentation technologies and MUST NOT own gameplay authority.

The domain layer MUST NOT publish or subscribe to the repository event bus directly.

## 5. Foundation Contract Primitives

PR0 SHALL provide a small `foundation/contracts` package for repository-wide application-contract primitives. It MUST contain generic types only and MUST NOT contain gameplay-specific semantics.

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

Gameplay systems specialize the rejection type with discriminated unions.

Example:

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

User-facing messages, localization text, and presentation wording MUST NOT be embedded in domain rejection contracts. UI maps rejection codes to presentation behavior.

## 6. Query Semantics

A query is a synchronous read through the target system's public API.

A query:

- MUST NOT mutate canonical state.
- MUST NOT publish integration events.
- MUST NOT hide deferred mutations or side effects that change gameplay semantics.
- MAY use internal caches if cache maintenance is observationally transparent.
- MUST return explicit immutable/read-only DTOs, values, or snapshots rather than expose mutable internal collections.

A system may perform any number of cross-system queries without automatically becoming a cross-system orchestrator. The orchestration threshold is defined by mutation authorities, not by query count.

## 7. Command Semantics

A command requests one owning system to perform a mutation.

A command:

- has exactly one target mutation authority;
- is handled by the target system's application boundary;
- validates before canonical mutation;
- returns `CommandResult<TValue, TRejection>`;
- MUST NOT communicate expected business rejection through `throw`, `null`, `undefined`, or bare booleans;
- MAY throw only for programming faults, violated invariants that indicate defects, or infrastructure failures that cannot be represented as a normal business rejection.

A successful command result reports the result of the requested operation. It does **not** carry integration events for the caller to publish.

## 8. Integration Event Semantics

An integration event is an immutable fact that describes a canonical change that has already committed.

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

- MUST use an explicit stable event identifier/discriminator;
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
Owning system hands committed events to the dispatcher
  ↓
0..N subscribers
```

The caller, UI, and cross-system orchestrator MUST NOT be responsible for remembering to publish another system's integration events.

An event MUST NOT become externally observable before its associated canonical state is committed.

The exact implementation mechanism for collecting events — for example an event sink, transaction envelope, unit of work, or outbox — is deferred to ADR-003. ADR-003 MUST preserve the ownership rule above.

Event-delivery failure is not a business command rejection and MUST NOT retroactively convert an already committed canonical mutation into a rejected command. Durability, retry, recovery, and failure-recording semantics are defined by ADR-003.

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

If a use case issues commands to **exactly one** system mutation authority, it remains owned by that system's `application/` layer, regardless of how many other systems it queries.

Example:

```text
BuildRoad
  query Terrain buildability
  query Zoning occupancy
  command Roads
```

This remains a Roads application use case because only Roads is mutated.

Its query dependencies MUST use public query contracts and MUST preserve an acyclic package dependency graph.

### Cross-system use case

If a use case issues commands that mutate **more than one** system authority, it MUST live under the appropriate `orchestration/*` concern package.

Example:

```text
PurchaseAndBuildRoad
  command Economy debit funds
  command Roads build road
```

This is cross-system orchestration because it coordinates two mutation authorities and therefore owns application-level sequencing, compensation/atomicity requirements, and result composition.

A use case MUST NOT be moved into orchestration merely because it performs multiple read-only queries.

## 12. Orchestration Namespace

`orchestration/` is a top-level architectural namespace, not one monolithic package.

Expected concern packages may include:

```text
orchestration/
  gameplay/
  persistence/
  import-export/
  diagnostics/
```

Only packages justified by an actual cross-system concern should be created. PR0 does not create empty concern packages for speculative future needs.

`orchestration/gameplay` owns cross-system gameplay application policy. It MUST NOT become a generic dumping ground for all application behavior.

Save/load orchestration, if required by ADR-003, belongs to a persistence-specific orchestration concern rather than being forced into `orchestration/gameplay`.

`apps/game` wires orchestration dependencies but does not absorb orchestration logic.

## 13. Cross-System Transaction Boundary

ADR-001 intentionally does not prescribe one global transaction mechanism.

It does prescribe these constraints:

- a single-system command owns its own atomic mutation boundary;
- a multi-system orchestrator MUST make sequencing and failure behavior explicit;
- multi-system atomicity MUST NOT be simulated by abusing the event bus;
- integration events remain post-commit facts;
- persistence and transaction coordination mechanisms defined later MUST preserve system ownership and event ownership.

ADR-003 owns the concrete transaction/persistence design.

## 14. Public Contract Design

Cross-system contracts SHOULD be small, immutable, and intention-revealing.

Public contracts MUST NOT leak:

- Three.js objects;
- DOM objects;
- mutable internal collections;
- internal entity classes solely for caller convenience;
- implementation-specific caches;
- private application services.

DTOs and events SHOULD use stable value identifiers and domain primitives that are themselves part of approved public contracts.

## 15. Contract Compatibility

A public command/query/event/DTO change is an observable contract change.

Such a change MUST:

1. identify affected consumers;
2. update the repository verification map or affected-graph metadata when dependency relationships change;
3. update contract tests in the same PR;
4. update owning system documentation;
5. explicitly address persisted or replayed compatibility when the contract is save/replay facing.

The Product Architecture v2 dependency graph MUST be derived from the new package manifests and public contracts. The legacy static verification chain is not architectural authority for v2.

## 16. Contract Testing

Every exported cross-system contract requires first-class automated verification.

Required categories:

- command-result success and rejection shape tests;
- public query DTO shape/semantic tests;
- integration-event discriminator and payload contract tests;
- package export-boundary tests;
- architecture import-boundary tests.

Snapshot tests MAY be used where useful but MUST NOT be the only semantic assertion when a structural or behavioral assertion is clearer.

Contract tests belong with the owning system and run as part of Level 1 owner verification. Public changes additionally trigger affected-consumer verification.

## 17. Architecture Enforcement

PR0 SHALL add automated boundary checks that reject at least these patterns:

```text
foundation/* → systems/*
foundation/* → orchestration/*
foundation/* → apps/*

systems/* → orchestration/*
systems/* → apps/*

system A → system B internal paths
system domain → foundation/event-bus
system domain → Three.js
system domain → DOM/browser APIs
```

PR0 SHALL also enforce that cross-system imports resolve through declared package exports rather than filesystem-relative deep imports.

Boundary verification must participate in the fast owner/development loop and must not exist only as a final repository-wide release check.

## 18. Failure Semantics

Expected business rejection is represented by typed `CommandResult` rejection unions.

Infrastructure and programming failures are separate from business rejection.

Rules:

- UI MUST NOT infer rejection meaning from exception-message strings.
- An orchestrator MUST handle each commanded system's typed rejection explicitly.
- Subscriber failure MUST NOT mutate the meaning of the originating command result after the source mutation committed.
- Hidden best-effort cross-system mutation from an event subscriber is forbidden when correctness requires the caller to know whether that mutation succeeded. Such behavior must be modeled as explicit orchestration or as an eventually consistent process whose semantics are separately documented.

## 19. Example Interaction

A single-authority Roads use case:

```text
UI
 ↓
Roads public command/application API
 ↓
Roads application use case
 ├─ Terrain public Query Port
 ├─ Zoning public Query Port
 └─ Roads domain mutation
         ↓
       COMMIT
         ↓
      RoadBuilt
         ↓
 foundation/event-bus
    ├─ zoning projection/cache invalidation
    ├─ mobility graph invalidation
    └─ presentation synchronization
```

A multi-authority gameplay use case:

```text
UI
 ↓
orchestration/gameplay
 ├─ Economy Command Port
 └─ Roads Command Port
       ↓
explicit sequencing / transaction policy
       ↓
each owning system commits its authority
and owns its own post-commit integration events
```

## 20. Forbidden Patterns

The following patterns are architecture violations:

- deep-importing another system's domain/application implementation;
- using events as commands to obtain request/response behavior;
- correlation-id plus response-event RPC as a substitute for a command port;
- returning another system's events in `CommandResult` for the caller to publish;
- publishing an integration event before canonical commit;
- letting domain code know about the event bus;
- hiding gameplay mutation inside a query;
- placing multi-authority gameplay orchestration in `apps/game`;
- placing gameplay-specific orchestration in `foundation/*`;
- treating `orchestration/gameplay` as the only orchestration concern for the whole repository;
- using the event bus as a transaction coordinator;
- treating the legacy static Level 2 verification map as the Product Architecture v2 dependency graph.

## 21. Consequences and Trade-offs

### Benefits

- System ownership remains explicit.
- Normal business rejection is type-safe and consistent.
- Event consumers cannot control command success semantics.
- Callers cannot accidentally omit or duplicate another system's event publication.
- Multi-system mutation policy has one visible home outside the app composition root.
- Systems remain independently testable without booting the full game.
- Event-driven coupling is constrained to post-commit facts rather than becoming hidden RPC.

### Costs

- Public ports and contracts require deliberate design and maintenance.
- Cross-system query dependencies can still form undesirable graphs if not reviewed; acyclicity must be enforced.
- Multi-authority use cases add an orchestration package boundary instead of being implemented inline.
- Post-commit event durability requires an additional transaction/persistence design in ADR-003.

These costs are accepted because they make dependency direction, mutation ownership, failure behavior, and test boundaries explicit.

## 22. PR0 Enforcement Requirements

PR0 Product Architecture v2 Bootstrap MUST establish enough structure to make this ADR executable rather than aspirational:

1. Create `foundation/contracts` with canonical command/rejection primitives.
2. Create `foundation/event-bus` with typed integration-event transport contracts only.
3. Create the top-level `orchestration/` namespace and only the concern package(s) required by actual PR0 behavior.
4. Establish the system package public-export convention.
5. Add architecture boundary tests for dependency direction and forbidden deep imports.
6. Add representative contract tests proving typed command rejection and integration-event shape handling.
7. Ensure boundary tests run in the fast development/owner verification loop.
8. Document how new systems register affected consumers in the v2 verification topology.
9. Do not import legacy package dependency assumptions into the v2 graph without an explicit new decision.

## 23. Follow-up ADRs

This decision is the foundation for:

```text
ADR-002  SimClock + Deterministic Simulation Scheduler
ADR-003  Persistence / Transaction / Save Ownership
ADR-004  Data-Oriented Domain / ECS Boundary
PR0      Product Architecture v2 Bootstrap
```

ADR-002 MUST preserve explicit ordered scheduling rather than using pub/sub delivery order as simulation order.

ADR-003 MUST preserve owning-system event collection/dispatch responsibility while defining the concrete commit, durability, outbox/recovery, and save transaction mechanisms.

ADR-004 MUST preserve the public communication boundaries in this ADR regardless of internal OOP, data-oriented, SoA, or ECS implementation choices.

## Final Invariants

```text
One canonical mutation → one owning system.

Read another system → Query.
Ask one system to mutate → Command.
Announce an already committed fact → Integration Event.
Mutate more than one system → orchestration/*.

The owning system owns its committed integration events.
The caller never publishes another system's events.
The event bus transports facts; it does not run workflows.
apps/game composes; it does not become the business-use-case layer.
foundation stays below gameplay and never depends upward.
```
