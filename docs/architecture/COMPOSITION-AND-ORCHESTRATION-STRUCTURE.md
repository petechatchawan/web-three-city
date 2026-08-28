# Composition and Orchestration Structure

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-28
- **Scope:** Application composition root, dependency inversion wiring, orchestration package structure, and cross-system policy placement
- **Depends on:** Product Architecture, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure, A6 Public Export & Dependency Rules
- **Sequence:** A7 — Composition & Orchestration Structure

## 1. Purpose

This document defines where concrete wiring and genuine cross-system policy live.

Core distinction:

```text
Composition
= assembles concrete dependencies

Orchestration
= owns explicit cross-system application policy
```

They are related but not interchangeable.

## 2. Product composition root

`apps/game` owns the product-level composition root.

Default application structure:

```text
apps/game/src/
├─ bootstrap/
├─ composition/
├─ ui/
└─ presentation/
```

Only folders with real code are created.

`composition/` is the authoritative place for concrete cross-package wiring.

It may assemble:

```text
Foundation implementations
system factories
system-owned ports/adapters
orchestration factories
presentation adapters
application configuration
```

It must not contain canonical gameplay rules or hidden business workflows.

## 3. Composition responsibilities

Composition may:

```text
instantiate concrete implementations
supply dependencies to factories
bind consumer-owned ports to provider adapters
select environment/browser implementations
assemble system/orchestration object graphs
validate startup dependency availability
```

Composition must not:

```text
make gameplay decisions
sequence business Commands as hidden use cases
mutate canonical state during module import
publish gameplay events manually on behalf of owners
become a global service locator
```

## 4. Explicit construction

Construction must be explicit and traceable.

Preferred concept:

```text
create dependency
  ↓
pass dependency into owner factory
  ↓
receive public capability
  ↓
wire consumer
```

Forbidden patterns include:

```text
import-time self-registration
global container lookup
ambient singleton discovery
string-based service discovery
package A constructing hidden internals of package B
```

A package may construct its own internals behind its A6 `./composition` factory. The app composes the package through that declared construction surface.

## 5. Dependency inversion wiring

When System A needs information semantically owned by System B but a direct A -> B import would violate the approved dependency graph, A owns an internal port.

```text
System A application
  ↓
A-owned ReadPort
  ↑
apps/game composition adapter
  ↓
System B public root Query
```

Rules:

```text
consumer owns the port
provider does not implement consumer policy
adapter performs trivial translation/wiring only
adapter does not acquire gameplay authority
```

If the adapter begins sequencing Commands, deciding business outcomes, or coordinating mutation authorities, that logic is not wiring; it must be redesigned as owner application logic or orchestration.

## 6. Composition organization

`apps/game/src/composition/` should be organized by wiring responsibility rather than one giant file.

Recommended capability-oriented shape when needed:

```text
composition/
├─ foundation/
├─ systems/
├─ orchestration/
├─ presentation/
└─ create-game.ts
```

These are optional organizational folders, not packages.

`create-game.ts` or equivalent should remain a thin assembly entrypoint. Detailed package construction belongs in focused composition modules.

The composition tree must not recreate a second domain hierarchy.

## 7. Bootstrap vs composition

`bootstrap/` starts the executable application.

Conceptually:

```text
browser/process entry
  ↓
bootstrap environment
  ↓
composition root builds product
  ↓
start presentation/runtime boundaries
```

Bootstrap may handle startup concerns such as:

```text
DOM mount discovery
configuration loading
error boundary setup
browser capability checks
startup invocation
```

It must not contain gameplay business rules or cross-system policy.

## 8. Orchestration ownership

An orchestration package exists only when a real concern coordinates more than one canonical mutation authority or another irreducibly cross-system policy under ADR-001.

Canonical threshold:

```text
one mutation authority
-> owning system application

more than one mutation authority
-> orchestration concern
```

Number of Queries does not determine orchestration placement.

## 9. Orchestration naming

Orchestration package names describe the policy/concern, not the list of participating systems.

Prefer concern-based names such as:

```text
orchestration/<business-concern>
orchestration/<workflow-concern>
orchestration/<coordination-purpose>
```

Avoid pair-based names such as:

```text
orchestration/economy-roads
orchestration/roads-zoning-buildings
```

unless the pair itself is the stable business concept, which requires explicit justification.

A package name must remain meaningful if one participating system implementation changes.

## 10. Default orchestration package structure

Default:

```text
orchestration/<concern>/
├─ package.json
├─ src/
│  ├─ application/
│  ├─ contracts/
│  ├─ ports/
│  └─ composition/
└─ tests/
```

Only needed folders are created.

Unlike a gameplay system, orchestration does not get a `domain/` folder by default because it should not become a second owner of system domain entities/state.

A concern may justify policy/state abstractions later, but any durable/canonical orchestration state requires explicit ownership and persistence design rather than silently creating a hidden domain.

## 11. Orchestration `application/`

Owns cross-system sequencing/policy such as:

```text
invoke System A Command
interpret typed result
invoke System B Command
compose final result
apply approved compensation/failure policy
coordinate read-before-command decisions
```

It must use public system surfaces only.

It must not:

```text
deep-import system internals
mutate system state directly
publish system Integration Events manually
become a scheduler substitute
use event delivery order as business sequencing
```

Transaction/compensation semantics remain deferred to persistence/transaction architecture.

## 12. Orchestration `contracts/`

Contains public orchestration input/output/result contracts when `apps/*` needs to invoke the concern.

Contracts should describe the orchestration use case rather than duplicate every underlying system contract.

Orchestration must not re-export system APIs merely for convenience.

## 13. Orchestration `ports/`

Ports are internal by default and used only when the orchestration concern itself needs dependency inversion beyond direct approved public system APIs.

Examples may include external product services or environment capabilities.

Do not create ports around every system Command simply to hide explicit dependencies. System Command dependencies are expected and should remain visible in manifests/imports.

## 14. Orchestration `composition/`

Owns factory/construction internals for the concern.

Selected construction entrypoints may be exposed to `apps/*` according to A6.

It must not become a gameplay operation surface.

## 15. Orchestration dependency graph

Default:

```text
orchestration/A -> orchestration/B   FORBIDDEN
```

When a proposed concern appears to need another orchestration package, first ask whether:

```text
the concerns should merge
the higher-level policy belongs in a new orchestration concern
shared behavior belongs in a system/Foundation owner
apps composition can invoke them independently
```

Only a deliberately approved, acyclic concern dependency may be introduced.

Orchestration chains must not form a shadow application hierarchy.

## 16. UI interaction placement

UI/application shell may:

```text
invoke one system Command directly for a single-authority user action
invoke one orchestration operation for a multi-authority user action
invoke Queries for presentation/read needs
```

UI components must not manually coordinate multiple system Commands as business policy.

Bad:

```text
button handler
  -> Economy Command
  -> Roads Command
  -> manual rollback
```

Correct ownership:

```text
button handler
  -> approved construction/purchase orchestration operation
```

## 17. Presentation composition

`apps/game` may compose system-owned Three.js presentation projections into the product scene/UI.

Product-level presentation coordination belongs in the app when it is about shell/view assembly rather than gameplay policy.

Example:

```text
attach Roads presentation projection to scene
attach Terrain presentation projection to scene
configure camera/UI shell
```

This does not transfer gameplay authority to `apps/game`.

## 18. Lifecycle wiring

Composition may establish lifecycle ordering required to construct/start/dispose components, but A7 does not define canonical simulation scheduling.

Construction/startup ordering is architecture wiring only when it does not encode gameplay tick semantics.

If gameplay outcome depends on execution ordering, that is runtime/scheduler architecture and must be explicitly designed later.

## 19. Failure boundaries

Composition failures are startup/infrastructure failures, not expected business rejections.

Orchestration expected business outcomes use typed result/rejection contracts from participating systems and its own public result contract.

A failure after one system has committed cannot be retroactively represented as if that system never committed. Concrete transaction/compensation policy is deferred, but orchestration must make such boundaries explicit rather than hide them.

## 20. Anti-pattern checklist

- [ ] composition root contains gameplay rules;
- [ ] bootstrap sequences gameplay Commands;
- [ ] package self-registers into global container at import time;
- [ ] system discovers provider through service locator;
- [ ] dependency-inversion adapter contains business policy;
- [ ] app UI coordinates multiple mutation authorities directly;
- [ ] orchestration exists for a one-authority use case;
- [ ] orchestration package name is merely a list of participating systems;
- [ ] orchestration owns another system's domain entity/state;
- [ ] orchestration deep-imports system internals/composition;
- [ ] orchestration publishes another system's Integration Events;
- [ ] orchestration-to-orchestration chains become a shadow hierarchy;
- [ ] one giant composition file becomes hidden god object;
- [ ] presentation wiring is mistaken for gameplay ownership.

## 21. Definition of Done examples

```text
Roads needs Terrain read and direct Query edge is approved
-> Roads application may import Terrain root read surface

Roads needs Terrain read but direct edge would cycle
-> Roads owns TerrainReadPort; apps/game wires adapter to Terrain Query

BuildRoad mutates Roads only
-> systems/roads/application

PurchaseAndBuildRoad mutates Economy + Roads
-> orchestration/<approved concern>

UI button manually commands Economy then Roads
-> invalid hidden orchestration

apps/game constructs Roads through ./composition
-> valid composition

orchestration imports Roads ./composition
-> invalid

adapter converts Terrain Query DTO to Roads-owned port DTO
-> valid trivial wiring

adapter decides whether road purchase is affordable and triggers Economy Command
-> invalid; business policy, not adapter wiring
```

## 22. Deferred decisions

A7 intentionally does not freeze:

```text
cross-system atomicity/compensation implementation
save/load orchestration semantics
runtime scheduler ordering
concrete DI library/container choice
exact browser bootstrap implementation
A9 test topology details
A11 enforcement implementation
```

## 23. Final invariants

```text
apps/game owns concrete product composition.
Composition wires; it does not own gameplay policy.
Bootstrap starts; it does not become application business logic.
Consumer owns dependency-inversion port.
Composition adapter translates/wires only.
One mutation authority stays in owning system.
Multiple mutation authorities require explicit orchestration.
Orchestration names describe concerns, not dependency lists.
Orchestration consumes public system APIs only.
UI never hides multi-system business sequencing.
Orchestration does not publish another system's events.
Orchestration dependencies are forbidden by default.
Product presentation assembly does not gain gameplay authority.
```