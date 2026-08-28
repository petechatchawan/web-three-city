# System Internal Structure

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Internal structure and dependency direction inside `systems/*` packages
- **Depends on:** Product Architecture, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model
- **Sequence:** A5 — System Internal Structure

## 1. Purpose

This document defines the default internal structure of a bounded gameplay system package without changing its A3 ownership boundary or A4 package capsule.

Core rule:

```text
Internal folders exist to separate responsibilities inside one owner.
They do not create new package ownership boundaries.
```

A system remains one package by default. Technical layers do not become packages merely because they are separated internally.

## 2. Default system shape

The default conventional system package is:

```text
systems/<system>/
├─ package.json
├─ src/
│  ├─ domain/
│  ├─ application/
│  ├─ contracts/
│  ├─ ports/
│  ├─ presentation/
│  └─ composition/
└─ tests/
```

These directories are **semantic slots, not mandatory empty scaffolding**.

A directory is created only when the system has code that belongs there.

The package may use fewer folders. A system-specific design may add a capability-named internal folder when a responsibility does not fit these defaults, provided it does not create a hidden ownership layer or violate dependency direction.

## 3. `domain/` — canonical gameplay rules and state

`domain/` owns the system's gameplay semantics that can be expressed independently of application orchestration and presentation technology.

Typical responsibilities:

```text
canonical entities/state
value objects
invariants
pure domain services
state transition rules
domain calculations
owner-local derived state
```

`domain/` must not depend on:

```text
application/
contracts/ as an outer API layer
ports/
presentation/
composition/
DOM/browser APIs
Three.js
apps/*
orchestration/*
another system's internals
concrete persistence/event-bus/runtime implementations
```

`domain/` may depend on stable Foundation primitives when the relevant Foundation capability is approved.

A domain type is not public merely because it is important. Public exposure still requires an explicit contract decision under A4/A6.

Stable owner value types may originate in `domain/` and later be deliberately exposed through a public package surface; that exposure does not invert the domain toward an outer contracts layer.

## 4. `application/` — owner use cases and mutation boundary

`application/` coordinates use cases that belong to exactly one system authority.

Typical responsibilities:

```text
Command handling
Query implementation
use-case sequencing inside one owner
business validation before mutation
owner-local transaction boundary coordination
translation between contracts and domain operations
collection/finalization of owner Integration Events
calling approved outbound ports
```

A use case remains here when it mutates only this system even if it reads other systems through approved Query dependencies or injected ReadPorts.

If it coordinates mutation of more than one canonical authority, it does not belong here; it belongs in `orchestration/*` under ADR-001/A7.

`application/` may depend on:

```text
domain/
contracts/
ports/
approved Foundation APIs
approved other-system root read contracts when A3/ADR-001 permit direct Query dependency
```

It must not depend on:

```text
presentation/
apps/*
orchestration/*
another system's ./commands
another system's ./composition
```

## 5. `contracts/` — externally observable contract candidates

`contracts/` contains types/protocols eligible to participate in deliberate package exports.

Typical categories may include:

```text
queries
commands
integration events
read DTOs
stable public value types
typed rejections/results specific to the system
```

The folder does **not** itself make a type public. A6/package `exports` remains public authority.

Contracts should be:

```text
minimal
intention-revealing
semantically immutable where read-oriented
free of internal implementation references
free of private ports
free of Three.js/DOM objects unless the contract is explicitly presentation-specific and approved
```

A contract may reference an owner-defined stable value type only when that value is itself deliberately part of the approved public contract. It must not expose private domain entities or storage representations.

A system does not create empty Query/Command/Event folders merely to match a template.

## 6. `ports/` — internal dependency-inversion interfaces

`ports/` contains interfaces the system needs from outside its own implementation boundary.

Examples:

```text
TerrainReadPort
ClockPort
PersistencePort
RandomSourcePort
EventDispatchPort
```

A port is **owned by the consumer that needs the capability**, not by the provider implementation.

Ports are internal by default.

They may be implemented by:

```text
package-local adapter
Foundation adapter
apps/game composition adapter
```

A selected construction-only port may be deliberately exposed through the package composition surface when A6 requires it for wiring. It must not leak into public read or command contracts.

Ports must not become a generic interface bucket for every class boundary. Create a port only at a meaningful dependency inversion seam.

## 7. `presentation/` — system-owned presentation projection

`presentation/` owns presentation code specific to this system's concepts when keeping it inside the same package preserves one coherent owner.

Typical responsibilities:

```text
Three.js projection/builders
system-specific render state
visual synchronization from public/internal system state
system-owned interaction projection
presentation caches that are not gameplay authority
```

Default technology-specific location when needed:

```text
presentation/three/
```

Presentation may depend inward on application/contracts/domain read models as appropriate, but canonical gameplay state must never depend outward on presentation.

```text
domain/application -> presentation   FORBIDDEN
presentation -> domain/application   ALLOWED when needed
```

Three.js objects, meshes, materials, scene nodes, DOM state, and render caches are not canonical gameplay authority.

The presence of presentation code does not justify splitting a `*-three` package by itself.

## 8. `composition/` — package construction internals

`composition/` owns construction logic required to assemble the system from explicit dependencies.

Typical responsibilities:

```text
system factory
internal object graph creation
adapter assembly local to the package
registration descriptors
construction-time validation
```

It must not become a hidden service locator or runtime business layer.

`composition/` may depend on all internal layers required to construct the package.

Other systems and orchestration packages must not import it. A6 defines which selected construction entrypoints may be exported through `./composition` for `apps/*`.

## 9. Internal dependency direction

Default conventional direction:

```text
presentation ───────┐
                    ▼
composition -> application -> domain
                 │
                 ├──────> contracts
                 └──────> ports
```

More precisely:

```text
domain
  -> approved Foundation primitives only

contracts
  -> approved Foundation/public value primitives when needed
  -> deliberately public owner value types when needed
  -> must not depend on private application/domain implementations

ports
  -> contracts/Foundation value types when needed
  -> must not depend on concrete adapters

application
  -> domain
  -> contracts
  -> ports
  -> approved external read contracts

presentation
  -> contracts/application/domain read capabilities as needed
  -> presentation technology

composition
  -> package internals
  -> approved construction dependencies
```

Circular internal dependencies between semantic layers are a design smell and should be removed rather than normalized.

## 10. Domain purity and technology boundaries

The following are forbidden in `domain/` unless a future approved architecture decision explicitly changes the rule:

```text
Three.js imports
DOM/window/document APIs
UI framework APIs
network client implementations
filesystem/browser storage implementations
concrete event bus
concrete persistence repository
apps/game imports
orchestration imports
```

A system may use technology-specific implementation elsewhere in the same package without transferring authority to that technology.

## 11. Derived state placement

Not every derived concept deserves a new system.

A derived calculation/projection remains internal to its owner when:

```text
it has no independent semantic ownership
it exists only to support owner behavior/query/presentation
it cannot be meaningfully understood without the owner
it has no justified independent public contract/lifecycle
```

A new derived system is considered only when A3's package-creation tests demonstrate a distinct bounded gameplay capability.

This prevents every cache, projection, index, graph view, or materialization from becoming a top-level system.

## 12. Internal shared helpers

System-local reusable code stays inside the owning system.

Do not create internal catch-all folders such as:

```text
shared/
common/
utils/
helpers/
```

as dumping grounds.

Prefer capability-specific names that communicate responsibility. A small local helper may remain near its consumer until a coherent local concept emerges.

Repository-level promotion follows A3 semantic ownership rules, not code similarity.

## 13. Internal errors and rejection boundaries

Expected business rejection produced by application use cases is represented through the approved typed contract model from ADR-001.

Internal domain invariant violations may use owner-local error/invariant mechanisms, but they must not leak accidentally into public contracts as implementation-shaped exceptions or strings.

A5 does not define final error serialization or infrastructure failure policy.

## 14. System lifecycle shape

A system package should support a lifecycle conceptually separable into:

```text
construct
  ↓
initialize if required
  ↓
serve Commands / Queries / scheduled owner work
  ↓
dispose if required
```

A5 does not require every system to implement all lifecycle phases.

Construction dependencies are explicit. Runtime dependencies are not discovered through globals or import-time self-registration.

Exact scheduler/runtime lifecycle remains outside A5.

## 15. Testing ownership inside a system

Package-owned tests are part of the same ownership boundary under A4.

Recommended broad categories:

```text
src/**/*.test.ts
  -> focused unit/domain/application tests close to implementation

tests/
  -> package-level contract/system integration tests
```

This is a structure default; A9 freezes the repository-wide testing model.

Public-contract verification should use public surfaces; internal invariant/unit tests may access internal code because they share the owner boundary.

## 16. Default structure vs approved variation

The default conventional structure is not a prohibition on data-oriented/ECS-heavy internals.

A later system design may vary internal organization when there is evidence, provided it preserves:

```text
one package owner
A4 encapsulation
public export rules
external dependency direction
canonical authority
cross-system communication rules
testability/documentation obligations
```

An alternate internal model must document its mapping back to the responsibilities defined here in the owning system's binding design/documentation, and any mechanically different layout must also be represented by the narrow A11-approved layout mapping/profile rather than disabling enforcement.

## 17. Anti-pattern checklist

The following indicate an invalid or degrading internal structure:

- [ ] `domain/` imports contracts/application/presentation/composition, Three.js, DOM, app, orchestration, or concrete infrastructure;
- [ ] `application/` directly calls another system's command/composition surface;
- [ ] `contracts/` exposes private domain entities, stores, adapters, or ports;
- [ ] `ports/` becomes a generic interface-per-class bucket;
- [ ] `presentation/` becomes canonical gameplay state;
- [ ] `composition/` becomes service locator/runtime business logic;
- [ ] cross-layer cycles are accepted instead of redesigned;
- [ ] empty semantic folders are created only to satisfy a template;
- [ ] `shared/common/utils/helpers` becomes an internal dumping ground;
- [ ] a derived cache/projection is promoted to a new system without independent ownership;
- [ ] technical presentation separation creates a new package without A3 evidence;
- [ ] multiple mutation authorities are coordinated inside one system application layer.

## 18. Definition of Done examples

```text
RoadNetwork invariant
-> systems/roads/src/domain

BuildRoad single-authority use case
-> systems/roads/src/application

BuildRoadCommand contract
-> systems/roads/src/contracts

TerrainReadPort required by Roads
-> systems/roads/src/ports

Three.js Road mesh projection
-> systems/roads/src/presentation/three

createRoadsSystem factory
-> systems/roads/src/composition

Road mesh cache used only by Roads rendering
-> presentation/internal owner state, not a new system

Road connectivity index used only by Roads domain/query implementation
-> Roads internal derived state, not automatically systems/connectivity

PurchaseAndBuildRoad mutating Economy + Roads
-> not systems/roads/application; orchestration concern
```

## 19. Deferred decisions

A5 intentionally does not freeze:

```text
A6 exact export subpaths and consumer permissions
A7 orchestration package internals and app composition organization
A8 concrete Foundation package structure
A9 detailed test layering and repository test locations
A11 enforcement implementation
runtime/scheduler semantics
persistence transaction semantics
ECS/data-oriented runtime policy
```

## 20. Final invariants

```text
One system package remains one ownership boundary by default.
Internal folders separate responsibilities; they do not create package authority.
Domain owns gameplay rules/state and stays technology-independent.
Domain does not depend on outer contracts/application/ports/presentation/composition layers.
Application owns single-authority use cases.
Contracts are public candidates, not automatic public API.
Ports are consumer-owned dependency inversion seams and internal by default.
Presentation depends inward; gameplay authority never depends outward on presentation.
Composition constructs; it does not become runtime business policy.
No empty ceremonial folders.
No internal shared/common/utils dumping ground.
Derived implementation state stays internal unless A3 proves independent ownership.
Alternate ECS/data-oriented internals may vary structure only while preserving external contracts and ownership and must document their mapping in binding system documentation.
```