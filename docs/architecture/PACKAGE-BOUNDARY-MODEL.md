# Package Boundary Model

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Package identity, visibility, dependency declaration, cross-boundary state/identity, test boundaries, namespace policy profiles, and boundary lifecycle
- **Depends on:** Product Architecture, Product Architecture Blueprint, ADR-000, ADR-001, A3 Repository Topology & Ownership Model
- **Sequence:** A4 — Package Boundary Model

## 1. Purpose

This document defines one repository-wide package-boundary mechanism for all workspace packages, with namespace-specific policy profiles.

The chosen model is **Encapsulated Package / Explicit API**.

Core rule:

```text
Every workspace package is an architectural capsule.
Everything is internal by default.
Cross-package visibility exists only through deliberate package exports.
```

A monorepo does not grant privileged access between packages.

This document deliberately does not freeze detailed internal folder layout, exact public export subpaths or surface taxonomy, orchestration internals, concrete Foundation packages, detailed test topology, or enforcement implementation. Those remain A5, A6, A7, A8, A9, and A11 concerns.

## 2. Universal Package Contract

Every workspace package, regardless of namespace profile, follows these invariants:

```text
1. Internal by default.
2. Public only through explicit package exports.
3. Cross-package deep imports are forbidden.
4. Every cross-package dependency is explicitly declared.
5. Consumers depend on contracts/capabilities, not implementation internals.
6. Mutable implementation state never crosses package boundaries.
7. Hidden dependency channels through globals, service locators, or import side effects are forbidden.
8. Another package's tests receive no privileged internal access.
9. Internals may evolve without consumer changes when the public contract is unchanged.
10. Same monorepo != privileged access.
```

Namespace profiles may add restrictions. They do not weaken these universal rules.

## 3. Package Identity

A package is not merely a directory. It is an architectural boundary with a unique identity.

Conceptually:

```text
workspace package
=
package root
+ unique package identity
+ ownership namespace
+ declared dependencies
+ declared public boundary
+ private implementation
```

### 3.1 Package root

A workspace-recognized `package.json` defines an architectural package root.

Production files within that root belong to that package unless a later approved architecture decision explicitly classifies them otherwise.

Package-owned tests remain inside the same ownership boundary even when colocated under package-local `tests/`, `__tests__/`, or equivalent paths.

Nested workspace packages are not created merely to split technical layers. Creating one requires an A3-compliant package split decision with an independently justified ownership boundary.

Example of an unjustified technical split:

```text
systems/roads/
└─ renderer/
   └─ package.json   FORBIDDEN BY DEFAULT
```

### 3.2 Repository root package

The repository root may contain a `package.json` for workspace control-plane responsibilities.

```text
repository root package
=
workspace control plane

NOT
=
production/shared architectural package
```

Production packages must not treat the repository root as a shared library or import product behavior from it.

### 3.3 Default package naming policy

Package identity should reveal ownership and avoid cross-namespace collisions.

Default mapping:

```text
systems/<name>        -> @web-three-city/<name>
apps/<name>           -> @web-three-city/app-<name>
orchestration/<name>  -> @web-three-city/orchestration-<name>
foundation/<name>     -> @web-three-city/foundation-<name>
testkit/<name>        -> @web-three-city/testkit-<name>
tooling/<name>        -> @web-three-city/tooling-<name>
```

This is a default naming policy, not package-creation approval. A package still requires A3 ownership justification before it exists.

Deviation from the default naming policy requires explicit architecture justification.

Names should describe bounded capability/ownership rather than technical implementation. Technical suffixes such as `-core`, `-types`, `-utils`, or `-three` do not justify separate package identities by themselves.

## 4. Boundary Mechanism

### 4.1 Authoritative visibility boundary

`package.json` `exports` is the authoritative cross-package visibility boundary.

```text
Declared in package.json exports
=
mechanically visible package API

NOT
=
automatically permitted for every consumer profile
```

A6 defines the exact export surfaces, subpaths, semantics, and consumer permissions.

A package may declare multiple export entries. A4 does not require a single `"."` export and does not define the final subpath set.

An `index.ts` or any other barrel file may implement an export entry, but exporting from a TypeScript file does not make that symbol public across packages by itself.

### 4.2 Internal by default

The following do not make a symbol public package API:

```text
file exists in repository
local TypeScript export
internal barrel export
TypeScript path resolution
workspace filesystem visibility
```

Only a path deliberately included in the package export map is mechanically visible to another package.

### 4.3 Deep import definition

A **deep import** is any cross-package import that reaches a path not declared by the target package's export map.

Forbidden examples:

```ts
import { RoadNetwork } from "@web-three-city/roads/src/domain/RoadNetwork";
```

and:

```ts
import { RoadNetwork } from "../../roads/src/domain/RoadNetwork";
```

Crossing another package root by relative filesystem path is still a deep import.

Boundary rules may not be bypassed through:

```text
tsconfig path aliases
bundler aliases
workspace symlink paths
dynamic imports
type-only imports
filesystem reach-through
```

If Package A refers to Package B across package roots, it is a package dependency regardless of the resolution mechanism.

### 4.4 Type-only imports still create architectural edges

A type-only import may have no runtime JavaScript edge, but it still creates architectural coupling.

```ts
import type { RoadId } from "@web-three-city/roads";
```

Therefore architecture dependency analysis must include type-only cross-package imports.

### 4.5 No friend access

The architecture has no general concept of:

```text
friend package
friend app
friend integration test
friend tooling consumer
```

External ownership means public boundary only.

Package-owned tests are not friend consumers; they are part of the same ownership boundary and are governed separately in Section 7.

## 5. Dependency Declaration

Every cross-package dependency must satisfy **both** conditions:

```text
1. Architecturally permitted.
2. Explicitly declared by the consuming package.
```

Manifest declaration does not create architecture permission, and architecture permission does not remove the requirement to declare the dependency.

Example:

```text
Roads -> Terrain read dependency
```

is valid only when the A3/ADR-001/A6 permission rules allow it **and** Roads explicitly declares Terrain as a dependency.

### 5.1 Same-package imports

Imports that remain within one package root are not cross-package dependencies for A4 purposes.

Their internal structure and dependency rules are refined in A5.

### 5.2 No transitive dependency reliance

If:

```text
A -> B -> C
```

A does not automatically gain permission to import C.

If A imports C directly, A must declare C directly and the A -> C edge must independently satisfy architecture rules.

### 5.3 Dependency classification follows actual use

Manifest classification must match real usage.

A dependency required to build or run production code must not be disguised as test-only or tooling-only merely to avoid production dependency rules.

Exact package-manager categories such as optional/peer policy are not frozen here.

### 5.4 Hidden dependency channels are forbidden

Cross-package dependencies must remain visible and explainable in the architecture graph.

Forbidden hidden channels include:

```text
globalThis / window as dependency registry
global mutable singleton registries
service locators
ambient mutable state
import-time self-registration
undeclared runtime lookup by string
filesystem reach-through
```

Concrete dependency inversion wired by `apps/game` composition remains allowed when approved by A3/ADR-001 because the ownership relationship is explicit and traceable.

## 6. Cross-Boundary State and Identity

A package may expose information about the state it owns. It must not expose ownership of its mutable internals.

Binding invariant:

```text
Internal mutable reference
MUST NOT cross a package boundary.
```

### 6.1 Safe cross-boundary values

Public boundaries should expose, as appropriate:

```text
primitive values
immutable/read-only DTOs
snapshots
stable public value types
package-owned stable identities
explicit public contracts
```

They must not expose mutation-capable domain entities, stores, caches, services, collections, or implementation objects owned by the package.

### 6.2 Semantic immutability

TypeScript `readonly` does not by itself prove package-boundary immutability.

A public value must be semantically immutable with respect to owner state:

- the consumer cannot mutate canonical/internal state through the value;
- the consumer cannot obtain mutation-capable implementation references;
- undocumented mutable aliasing is not exposed;
- public value methods must not mutate owner state.

A4 does **not** require `Object.freeze`, deep-freezing every DTO, or any particular runtime immutability technique. Implementation strategy may vary as long as semantic immutability holds.

### 6.3 Snapshot/value representation by default

Cross-package Query results default to snapshot/value representations rather than live mutable owner views.

Conceptually:

```text
Owner canonical/internal state
        ↓
Query projection
        ↓
immutable value / snapshot
        ↓
consumer
```

Future subscriptions, observable views, streams, or shared-memory designs require explicit contract design. They must not become accidental live-reference leakage.

### 6.4 Identity crosses boundaries; object ownership does not

Cross-package relationships should use stable public identity/value contracts rather than internal entity object references.

Conceptually:

```text
Roads owns Road entity/object
Other packages may know RoadId
```

A consumer that needs current Road information queries the Roads public contract rather than retaining a mutable Road entity reference.

### 6.5 Identity follows concept ownership

Identity types remain owned by the package that owns the concept.

Example:

```text
RoadId -> Roads public contract/value type
```

A shared need for `RoadId` does not justify moving it into Foundation.

### 6.6 Read boundaries cannot smuggle mutation

A Query/read contract must not return mutation capability disguised as data.

Forbidden concept:

```ts
interface RoadView {
  readonly id: RoadId;
  remove(): void;
  setSpeedLimit(value: number): void;
}
```

A read boundary remains observational. Mutation uses the approved mutation model from ADR-001/A6.

## 7. Test Boundary Model

A4 freezes visibility rules for tests, not detailed test topology.

### 7.1 Package-owned tests

Tests owned by a package are part of the same ownership boundary.

```text
Package-owned tests may access package internals when appropriate.
They are not required to test exclusively through the public package surface.
```

Examples include internal domain invariants, private algorithms, reconciliation logic, and implementation-specific unit tests.

A5/A9 refine exact placement and strategy.

### 7.2 External tests

A test outside the target package's ownership is an external consumer of that package.

Examples:

```text
systems/zoning/tests consuming Roads
tests/integration consuming Roads
tests/browser consuming Roads
testkit/* consuming Roads
```

Such tests may access Roads only through Roads' approved public boundary.

```text
external test != friend package
```

### 7.3 No public testing backdoor by default

Production packages do not create a public `./testing` or equivalent surface merely to expose private implementation for external tests.

A testing surface must not become a channel for internal stores, forced mutation, private graphs, or mutation-capable implementation objects.

Reusable package-owned testing helpers remain package-owned. Genuine generic cross-package testing infrastructure may belong in `testkit/*` under A3/A9 rules.

### 7.4 Contract verification uses the public contract

Tests whose purpose is to verify exported Query, Command, Event, or public value semantics should exercise the public contract actually consumed by other owners.

## 8. Namespace Policy Profiles

All workspace packages use the same boundary mechanism with namespace-specific policy profiles.

| Namespace | Profile | Boundary intent |
| --- | --- | --- |
| `systems/*` | `strict-production` | bounded gameplay owner |
| `foundation/*` | `strict-production` | generic stable lower-level capability |
| `orchestration/*` | `strict-production` | explicit cross-system coordination |
| `apps/*` | `application` | executable/composition boundary |
| `testkit/*` | `test-only` | reusable testing capability |
| `tooling/*` | `repository-tooling` | repository engineering capability |

The profile map corresponds directly to A3 ownership classes. It does not create new ownership categories.

### 8.1 `systems/*` — strict production

Systems own bounded gameplay capabilities.

Additional constraints:

```text
narrow deliberate public surface
no mutable domain/internal leakage
system -> system forbidden by default
reviewed read-only Query dependency only when A3/ADR-001 permit it
no direct cross-system mutation
no dependency on apps/*
no dependency on orchestration/*
```

Exact read/mutation/composition surface semantics are A6 concerns.

### 8.2 `foundation/*` — strict production

Foundation owns generic, gameplay-neutral lower-level capabilities.

Additional constraints:

```text
no gameplay ownership
no gameplay vocabulary smuggled into generic capability
no upward dependency on systems/orchestration/apps
Foundation package graph remains acyclic
public surface remains conservative
```

Foundation APIs deserve especially careful expansion because lower-level capabilities tend to accumulate many consumers.

### 8.3 `orchestration/*` — strict production

Orchestration owns explicit cross-system coordination policy justified by A3/ADR-001.

Additional constraints:

```text
consume approved public package capabilities only
no system internals
no system composition internals
no hidden system-owned mutable state
no domain entity ownership that properly belongs to a system
```

Internal structure and concern naming are refined in A7.

### 8.4 `apps/*` — application

Applications have broader composition permission because they assemble executable products.

They do **not** have broader encapsulation permission.

```text
Broader composition permission
!=
broader package visibility
```

Applications must still obey:

```text
no deep imports
declared dependencies only
no access to private system constructors/stores/internals
no mutation outside approved public capabilities
concrete cross-package wiring at the application composition boundary
no hidden service-location shortcuts
```

### 8.5 `testkit/*` — test-only

Testkit packages expose reusable testing capabilities through explicit package exports.

They must:

```text
declare dependencies
respect package boundaries of consumed packages
avoid private deep imports into production owners
avoid becoming shared gameplay implementation
```

Production packages must not depend on `testkit/*`.

### 8.6 `tooling/*` — repository-tooling

Tooling packages expose repository engineering capabilities through deliberate boundaries when consumed as packages.

Production packages must not depend on `tooling/*`.

Tooling may inspect repository files, manifests, import graphs, ASTs, or source metadata as data. Such inspection is different from importing another package's private implementation as an application/library dependency.

If tooling imports another package API as code, the normal declared-dependency and visibility rules apply.

## 9. Boundary Lifecycle and Contract Change

### 9.1 Internal change

Private implementation may evolve without consumer changes when the declared public contract remains stable.

Examples include:

```text
algorithm refactor
storage-model change
class-based -> data-oriented internals
cache replacement
Three.js projection-internal change
private file/folder reorganization
```

Encapsulation litmus test:

> Can Package B change its internal implementation without Package A changing, provided B's declared public contract is unchanged?

If the answer is unexpectedly no, the boundary is likely leaking implementation assumptions.

### 9.2 Public boundary expansion

Adding a new exported capability is an architecture decision because it creates new coupling surface.

Before expansion, reviewers must answer:

```text
Why must this capability become public?
Who is the named consumer?
What ownership contract does it expose?
Why can the requirement not remain internal?
```

Speculative public API is forbidden.

### 9.3 Public boundary contraction or breaking change

Removing or changing a public contract changes the consumer graph.

At minimum the change must:

```text
identify affected current consumers
update owner and affected consumers coherently
update relevant contract verification
```

For current internal-monorepo consumers, the Product Architecture interim rule remains: breaking contract changes update the owner and affected consumers atomically.

Long-lived external compatibility/versioning policy is not invented in A4.

### 9.4 Internal-to-public promotion

Promoting an internal implementation concept to public API is a boundary-design decision, not a convenience re-export.

Before promotion, determine whether:

```text
the consumer genuinely needs a stable public contract
ownership is incorrect
or implementation detail is being exposed to avoid designing a contract
```

A consumer asking for an internal symbol is not sufficient justification by itself.

### 9.5 Public API demotion

A public capability with no current justified consumer should be considered for removal rather than preserved speculatively.

Target principle:

```text
minimum sufficient public surface
```

### 9.6 Boundary erosion indicators

The following are warning signs that a package boundary is degrading:

```text
consumers import many implementation-shaped types
public DTO mirrors private storage layout 1:1
consumers change whenever owner internals are refactored
public surface grows without named consumers
test-only exports expose private state
shared mutable objects cross package roots
another package retains owner entity/object instances
repeated requests for deep-import exceptions
```

When several indicators appear, do not add another exception by default. Revisit ownership or contract design.

## 10. Boundary Anti-Pattern Checklist

The following are architecture violations unless explicitly superseded by a later approved architecture decision:

- [ ] cross-package path reaches a target path absent from the target `exports` map;
- [ ] relative filesystem import crosses another package root;
- [ ] alias/dynamic/type-only import is used to bypass package visibility;
- [ ] manifest declaration is treated as sufficient architecture permission;
- [ ] architecture permission is used without declaring the dependency;
- [ ] a package relies on another package's transitive dependency;
- [ ] production build/run dependency is classified as test/tooling-only to hide the edge;
- [ ] mutable owner object/store/entity/collection leaks across a package boundary;
- [ ] read/query result carries mutation methods or mutation-capable references;
- [ ] another package stores an owner's internal entity/object reference instead of stable public identity/value;
- [ ] `RoadId`-like gameplay identity is moved to Foundation merely because many systems use it;
- [ ] external tests deep-import target package internals;
- [ ] public `./testing` surface exposes private production state as a backdoor;
- [ ] applications use broad composition rights to deep-import system internals;
- [ ] testkit becomes shared production/gameplay implementation;
- [ ] tooling is imported by production runtime code;
- [ ] package public surface expands without a named current consumer;
- [ ] technical layer is split into a nested package without A3 ownership evidence;
- [ ] hidden globals/service locators/import side effects bypass declared package relationships.

## 11. Definition of Done / Boundary Examples

A4 is sufficiently precise when these cases classify unambiguously:

```text
import "@web-three-city/roads"
where the path is exported and consumer is permitted
-> potentially valid; manifest + architecture permission still required

import "@web-three-city/roads/src/domain/RoadNetwork"
-> invalid deep import

import "../../systems/roads/src/domain/RoadNetwork"
from another package
-> invalid deep import

import type { RoadId } from "@web-three-city/roads"
-> architectural dependency edge

Roads Query returns immutable RoadSummary snapshot
-> valid boundary shape

Roads Query returns InternalRoadEntity with setSpeedLimit()
-> invalid mutable/mutation-capability leak

Zoning stores RoadId
-> valid when the approved public contract/dependency permits it

Zoning stores mutable Roads entity object
-> invalid ownership leak

systems/roads/tests imports Roads internals
-> package-owned test; allowed when appropriate

systems/zoning/tests deep-imports Roads internals
-> invalid external-test access

testkit package imports Roads exported public API and declares the dependency
-> potentially valid under test-only profile

apps/game composes Roads through approved public/composition contracts
-> valid application responsibility

apps/game imports Roads private store
-> invalid despite application profile

tooling/architecture parses Roads package.json/source graph as repository data
-> valid tooling inspection

production system imports tooling/architecture runtime API
-> forbidden
```

## 12. Deferred Decisions

A4 intentionally does not freeze:

```text
A5  System Internal Structure
    -> domain/application/contracts/ports/presentation layout and internal dependency rules

A6  Public Export & Dependency Rules
    -> exact export subpaths, read/command/composition taxonomy, consumer permission mechanics

A7  Composition & Orchestration Structure
    -> orchestration internals, concern naming, application composition structure

A8  Foundation Structure
    -> concrete Foundation package set and capability ownership

A9  Testing Structure
    -> exact test placement, fixture topology, test layering

A11 Architecture Enforcement Design
    -> AST/import/package checks and enforcement implementation
```

Optional/peer dependency policy and long-lived external contract versioning are also outside A4 unless a current requirement later makes them necessary.

## 13. Final Invariants

```text
Package = architectural capsule, not just a directory.
One repository-wide package-boundary mechanism applies to every workspace package.
Everything is internal by default.
package.json exports defines mechanical cross-package visibility.
Exported != permitted for every consumer.
Cross-package deep imports are forbidden.
Relative reach-through across package roots is a deep import.
Type-only cross-package import is still an architectural dependency.
Every cross-package dependency must be both permitted and declared.
Same-package import is not a cross-package dependency.
Same monorepo != privileged access.
Mutable implementation state never crosses package boundaries.
Semantic immutability is required; deep-freezing is not mandated.
Cross-package identity uses stable public identity/value contracts, not owner object references.
Identity follows concept ownership.
Read boundaries cannot smuggle mutation capability.
Package-owned tests share owner visibility; external tests do not.
There is no general friend-access or testing-backdoor model.
Namespace profiles add restrictions without weakening universal boundary rules.
apps/* has broader composition permission, not broader encapsulation permission.
Public surface expansion requires a current justified consumer.
Internal refactors should not force consumer changes when public contracts are unchanged.
Minimum sufficient public surface is preferred.
Repeated boundary exceptions trigger design review, not automatic accommodation.
```