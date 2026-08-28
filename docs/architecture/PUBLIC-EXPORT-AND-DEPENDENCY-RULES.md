# Public Export and Dependency Rules

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-28
- **Scope:** Package export surfaces, consumer permissions, dependency graph rules, and public contract exposure
- **Depends on:** Product Architecture, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure
- **Sequence:** A6 — Public Export & Dependency Rules

## 1. Purpose

This document defines how workspace packages expose deliberate public surfaces and which ownership profiles may consume them.

A4 already freezes the mechanical boundary:

```text
package.json exports = cross-package visibility boundary
```

A6 adds semantic meaning and consumer permissions to that mechanism.

Core rule:

```text
Visible
!=
permitted
```

A path may be exported mechanically while still being forbidden to a particular consumer profile.

## 2. System export model

A gameplay system package uses up to three semantically distinct surfaces:

```text
"."              READ / OBSERVE
"./commands"     MUTATE
"./composition"  CONSTRUCT / WIRE
```

A package creates only the surfaces it actually needs. Empty or speculative subpath exports are forbidden.

### 2.1 Root read surface — `.`

The root surface of `systems/*` is read/observe-only.

It may expose:

```text
Query entrypoints
read-only/snapshot DTOs
stable public value types and identities
Integration Event types for observers
read contract types required by consumers
```

It must not expose:

```text
Command handlers
mutation-capable services
mutable entities/stores
composition factories
internal ports
private adapters
Three.js implementation objects
```

The root surface must remain safe for another system to consume under ADR-001's reviewed read-only exception.

### 2.2 Mutation surface — `./commands`

The command surface exposes the owning system's approved mutation contract.

It may expose:

```text
Command types
mutation entrypoints/application facade
CommandResult and system-specific typed rejection contracts
stable values needed to request/describe owned mutation
```

It must not expose:

```text
internal domain entity mutation methods
another system's commands
composition factories
caller-managed event publication hooks
private repositories/stores
```

Production import permissions:

```text
systems/*        NO
orchestration/*  YES
apps/*           YES
```

An app may invoke a single-system command from product/UI application wiring. If a use case coordinates mutation of more than one authority, it must use an orchestration concern instead of manually sequencing system commands in arbitrary UI code.

### 2.3 Construction surface — `./composition`

The composition surface exists only when external construction/wiring is necessary.

It may expose narrowly scoped capabilities such as:

```text
system factory
construction-time configuration contract
selected construction-only dependency interface
registration descriptor required by composition root
adapter/factory intentionally intended for app composition
```

It must not expose normal gameplay operations.

Production import permissions:

```text
systems/*        NO
orchestration/*  NO
apps/*           YES
```

`./composition` is not a shortcut for consumers that cannot find a needed symbol on the proper read or command surface.

## 3. System surface permission matrix

Production/workspace-package permissions:

```text
Consumer          system "."    system "./commands"    system "./composition"
-------------------------------------------------------------------------------
systems/*              YES*             NO                      NO
orchestration/*        YES              YES                     NO
apps/*                 YES              YES                     YES
foundation/*           NO               NO                      NO
testkit/*              YES**            NO                      NO
tooling/*              INSPECT***       NO                      NO
```

Notes:

- `YES*` — system-to-system root reads are forbidden by default at the dependency level and allowed only as an explicitly reviewed read-only Query edge under A3/ADR-001.
- `YES**` — testkit may consume exported system read APIs needed for reusable testing, but it receives no cross-package mutation or composition authority. If a reusable helper appears to require those surfaces, keep the helper with the owning package or revisit the architecture rather than adding a testing privilege implicitly.
- `INSPECT***` — repository tooling may parse package/source metadata as data. Importing the system's runtime API as code follows normal dependency permission and is not implied by inspection rights.

### 3.1 Repository-level test code

Top-level repository test code under `tests/*` is not a reusable workspace package and is not production code.

It may consume any **deliberately exported** public system surface required to verify a test scenario:

```text
"."              YES
"./commands"     YES when the test directly verifies/integrates owned mutation
"./composition"  YES when the test must construct an isolated public package graph
```

This is a test-only execution permission, not friend access.

Repository-level tests still must obey:

```text
no private/deep import
no relative reach-through
no access to non-exported internals
no hidden mutation outside approved public surfaces
```

This permission does not propagate into `testkit/*`. Reusable test packages remain constrained by the matrix above so testkit cannot become a privileged shared-internals layer.

## 4. Foundation exports

Foundation packages use the same A4 boundary mechanism but do not inherit system Command/Query semantics automatically.

Default Foundation surface:

```text
"."              stable generic capability
"./composition"  optional construction wiring when required
```

Foundation root exports may expose generic primitives, interfaces, deterministic utilities, contract primitives, or infrastructure abstractions approved by A8.

Foundation must not expose gameplay-specific vocabulary merely to satisfy consumers.

Foundation `./composition` may be consumed by apps when concrete wiring is required. Repository-level test code may consume a deliberately exported Foundation composition surface when needed for isolated integration setup. Other production consumers use the stable root capability unless a later architecture decision explicitly permits another subpath.

Foundation must never expose upward dependency hooks that require it to know systems/orchestration/apps.

## 5. Orchestration exports

An orchestration package represents an explicit cross-system concern, not a system authority.

Default surfaces:

```text
"."              orchestration operation/contracts
"./composition"  optional construction wiring for apps
```

The root may expose:

```text
orchestration use-case entrypoints
input/output contracts
orchestration-specific typed results/rejections
stable coordination status/read models when justified
```

It must not re-export system internals or become a convenience facade over every system API.

`apps/*` are the primary production consumers of orchestration operations.

Repository-level test code may consume orchestration public/composition surfaces when required to test an isolated concern, without receiving private access.

Orchestration-to-orchestration dependency is forbidden by default. An exception requires explicit architecture review, an acyclic graph, and a demonstrated concern dependency that cannot be represented more cleanly through apps composition or shared lower-level contracts.

## 6. Application exports

`apps/*` are executable product boundaries and are not general-purpose libraries.

Default:

```text
apps/* do not expose production library APIs for other ownership namespaces.
```

App-to-app dependencies are forbidden by default. If multiple applications later need shared behavior, that behavior must be assigned to the correct system/Foundation/orchestration owner rather than extracted into an app library by convenience.

Any future app embedding/composition relationship requires explicit product architecture approval.

Browser/journey tests interact with the app through executable/product behavior rather than treating the app as a shared library unless a specific public test surface is later approved.

## 7. Testkit exports

`testkit/*` exposes deliberate test-only APIs through explicit `exports`.

It may expose:

```text
reusable builders/fixtures
assertion helpers
deterministic test harnesses
public read-contract test utilities
browser/test drivers that are genuinely reusable
```

It must not expose or contain production gameplay implementation.

Production ownership profiles may not depend on testkit.

A testkit export does not grant access to private internals or privileged mutation/composition surfaces of production packages; it must consume only production APIs permitted to the testkit profile.

## 8. Tooling exports

`tooling/*` packages may expose repository-engineering APIs or CLI entrypoints for other tooling/CI consumers.

Production packages may not import tooling runtime APIs.

Tooling package exports remain explicit and minimal even though tooling can inspect repository files as data.

## 9. Public contract dependency rules

A public contract must not reference a symbol that its intended consumer cannot legally obtain.

Therefore exported read/command contracts must not leak:

```text
private domain entities
private application services
internal ports
private adapter types
private persistence representations
Three.js/DOM implementation types unless the public surface is explicitly presentation-specific and approved
symbols reachable only through deep import
```

A composition-only exported interface may reference construction concepts that remain isolated to `./composition`, but those types must not leak into `.` or `./commands`.

## 10. Re-export rules

A package should expose capabilities it owns, not become a transitively convenient export hub.

Default rule:

```text
Do not re-export another package's public API merely for convenience.
```

If Package A's public contract semantically requires a value type owned by Package B, A may reference B's public type where the dependency is permitted; consumers that need that type must have a valid dependency relationship rather than relying on accidental re-export chains.

Re-export is considered only when A truly owns a higher-level contract whose stable API intentionally incorporates the external type and the ownership remains unambiguous.

Barrel convenience does not justify changing ownership.

## 11. System-to-system read dependency review

Direct system read dependencies are exceptional and must be reviewed explicitly.

A proposed edge:

```text
systems/A -> systems/B root surface
```

must answer:

```text
What exact Query/read contract is required?
Why does A need synchronous direct access?
Can the requirement be satisfied by A-owned port + composition without creating a direct edge?
Does the edge preserve the acyclic system Query graph?
Does it introduce business sequencing that actually belongs in orchestration?
Is the dependency stable enough to justify coupling A to B's public vocabulary?
```

Approval is attached to the owning system design/change, not inferred from `package.json` alone.

## 12. Direct query graph

Architecture tooling derives the system-to-system root-read graph from actual production package imports and workspace manifests.

Binding rules:

```text
only root system read surfaces contribute approved direct production system Query edges
system command/composition edges are forbidden in production system consumers
system Query graph must remain acyclic
manual dependency graph is not authority
```

Test-only repository imports do not become production system dependency edges.

If semantic reads are bidirectional, one production direction must use dependency inversion as defined by ADR-001/A7 rather than creating a package cycle.

## 13. Same-layer dependencies

A3 marked some same-layer relationships as limited. A6 sharpens them.

### 13.1 `systems/* -> systems/*`

Forbidden by default; reviewed root-read Query exception only.

### 13.2 `foundation/* -> foundation/*`

Allowed only through explicit stable public APIs, with an acyclic graph and no gameplay leakage.

### 13.3 `orchestration/* -> orchestration/*`

Forbidden by default. Exception requires explicit architecture review and must remain acyclic.

### 13.4 `apps/* -> apps/*`

Forbidden by default. App reuse is not a general architecture pattern.

### 13.5 `testkit/* -> testkit/*`

Allowed only when a real reusable test capability depends on another test capability; dependencies are explicit and should remain acyclic.

### 13.6 `tooling/* -> tooling/*`

Allowed through explicit exports/dependencies when repository engineering capabilities are composed. Cycles should be rejected.

## 14. External third-party dependencies

Third-party packages do not bypass ownership rules.

Each workspace package declares the third-party dependencies it directly uses.

A system should not expose third-party implementation types in its public contract unless those types are intentionally part of the long-lived public vocabulary and the coupling is justified.

In particular, internal use of Three.js does not make Three.js types acceptable system domain/read contracts by default.

## 15. Public surface minimization

Every exported symbol should have a current architectural reason to be public.

Review questions:

```text
Who consumes this symbol?
Which ownership contract requires it?
Which export surface should own it?
Can the requirement be served by a smaller DTO/value/protocol?
Would exposing it couple consumers to internal implementation shape?
```

Wildcard public barrels that accidentally export implementation details are forbidden.

A symbol must not be promoted solely to simplify a test. Repository tests may use any already-approved public surface, but tests do not justify exposing private implementation by themselves.

## 16. Contract change propagation

A public contract change must identify its affected direct production consumers from the actual dependency graph and relevant test consumers from verification ownership.

Current monorepo rule:

```text
breaking public contract change
-> owner + affected current consumers updated atomically
-> relevant contract/architecture verification updated
```

A6 does not introduce external semantic-versioning policy before a real independently versioned consumer exists.

## 17. Anti-pattern checklist

- [ ] system root export exposes mutation entrypoint;
- [ ] system command surface is imported by another production system;
- [ ] system composition surface is imported by production system/orchestration;
- [ ] testkit imports system command/composition surface as a privileged testing shortcut;
- [ ] repository test deep-imports private implementation instead of using public surface;
- [ ] orchestration re-exports system internals as convenience facade;
- [ ] app is treated as reusable production library;
- [ ] Foundation adopts gameplay vocabulary to simplify exports;
- [ ] public contract references internal port/private entity/adapter;
- [ ] another package is re-exported without ownership justification;
- [ ] wildcard barrel exposes implementation accidentally;
- [ ] system-to-system Query edge is added without review;
- [ ] system Query graph contains a cycle;
- [ ] app/orchestration same-layer dependency becomes an unreviewed hierarchy;
- [ ] third-party implementation type leaks into stable gameplay contract by accident;
- [ ] export is created only to make testing easier;
- [ ] export is created without a current named consumer/use case;
- [ ] `./composition` is used as a backdoor gameplay API.

## 18. Definition of Done examples

```text
@web-three-city/roads
-> read/observe system surface

@web-three-city/roads/commands
-> Roads owned mutation surface; orchestration/apps in production, repository tests when directly verifying mutation

@web-three-city/roads/composition
-> Roads construction surface; apps in production, repository tests for isolated integration setup

Roads root exports getRoadSummary()
-> valid if observational and semantically immutable

Roads root exports removeRoad()
-> invalid; mutation belongs on ./commands

Zoning production imports @web-three-city/roads/commands
-> invalid

Construction orchestration imports @web-three-city/roads/commands
-> valid when orchestration concern is approved

apps/game imports @web-three-city/roads/composition
-> valid composition responsibility

tests/integration imports @web-three-city/roads/composition to build isolated public graph
-> valid test-only use

testkit helper imports @web-three-city/roads/commands
-> invalid privileged reusable-testing shortcut under current model

orchestration/A imports orchestration/B
-> forbidden by default; requires explicit architecture exception

foundation/foo exports ZoneType
-> invalid gameplay leakage
```

## 19. Deferred decisions

A6 intentionally does not freeze:

```text
A7 exact orchestration/app composition internals
A8 concrete Foundation package APIs
A9 detailed testing mechanics
A11 enforcement implementation/config format
external semantic-versioning policy
network/plugin/mod API versioning
```

## 20. Final invariants

```text
System "." = read/observe.
System "./commands" = owned mutation.
System "./composition" = construction/wiring.
Surfaces exist only when needed.
Exported != permitted for every consumer.
Production systems never import another system's command or composition surface.
Testkit receives no privileged command/composition access.
Repository-level tests may use deliberately exported public mutation/composition surfaces when required, but never private internals.
Direct production system root-read dependencies are reviewed exceptions and remain acyclic.
Orchestration may command systems; apps may compose systems.
Foundation exposes generic lower-level capabilities only.
Apps are executable boundaries, not shared libraries.
Public contracts never leak private implementation or ports.
Re-export convenience never changes ownership.
Public surfaces remain minimum sufficient.
Actual production imports/manifests, not manual maps, define dependency evidence.
```