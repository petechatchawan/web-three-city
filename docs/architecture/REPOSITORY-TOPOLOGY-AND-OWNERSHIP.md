# Repository Topology and Ownership Model

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Top-level repository topology, ownership classes, package granularity, creation/split/merge/delete rules, layer-level dependency direction, shared-code promotion, and structural anti-patterns
- **Depends on:** Product Architecture, Product Architecture Blueprint, ADR-000, ADR-001
- **Sequence:** A3 — Repository Topology & Ownership Model

## 1. Purpose

This document defines the repository's ownership-first physical model.

The core rule is:

```text
Code placement is decided by ownership,
not by implementation technology or convenience.
```

A file, package, or capability must have one clear architectural owner before it is created.

If ownership cannot be determined, the code/package is not ready to exist.

This document deliberately does not freeze detailed system-internal folders, exact export paths, orchestration internals, concrete foundation packages, detailed test placement, documentation templates, or architecture-tool implementation. Those are later Architecture & Structure stages.

## 2. Chosen approach

The repository uses **ownership-first namespaces**.

Canonical top-level model:

```text
web-three-city/
├─ apps/
├─ systems/
├─ orchestration/
├─ foundation/
├─ testkit/
├─ tests/
├─ tooling/
├─ docs/
├─ .github/
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig*.json
└─ repository configuration files
```

The architecture does not use a generic package bucket as its primary ownership model.

The following top-level catch-all source namespaces are forbidden:

```text
packages/
shared/
common/
utils/
lib/
legacy/
old/
archive/
```

A future top-level namespace requires an explicit architecture decision and a distinct ownership meaning that cannot be represented by the existing namespaces.

## 3. Ownership classes

### 3.1 `apps/*` — runnable product ownership

`apps/*` owns executable product boundaries.

The initial product application is:

```text
apps/game
```

An application may own:

- browser/process entrypoints;
- bootstrap sequencing;
- the product composition root;
- UI shell;
- browser integration;
- Three.js startup and presentation-loop wiring;
- concrete dependency/adaptor wiring;
- product-level configuration assembly.

An application must not own:

- canonical gameplay rules;
- bounded gameplay authority that belongs to a system;
- hidden multi-system business policy;
- canonical simulation state merely because it starts the runtime;
- persistence authority merely because it invokes save/load flows.

Architectural test:

> Removing `apps/game` must not make core gameplay rules impossible to test through their package/application contracts.

The application **composes** the product; it does not define gameplay truth.

### 3.2 `systems/*` — bounded gameplay ownership

Each `systems/<name>` package owns one coherent bounded gameplay capability/authority.

Conceptual future examples may include:

```text
systems/world
systems/terrain
systems/terraform
systems/roads
systems/zoning
systems/buildings
systems/households
systems/economy
systems/mobility
systems/traffic
```

These examples are not package-creation approval. A system package is created only when its own design is approved.

Canonical definition:

```text
system = bounded gameplay capability
         with one coherent ownership boundary
```

A system does not need to own mutable canonical state to qualify. A derived gameplay capability may still be a system when its semantic ownership is distinct, stable, and independently understandable.

Default granularity:

```text
1 bounded system
=
1 workspace package
=
1 architectural ownership boundary
```

A system package must declare the externally observable contract capabilities that apply to it:

- mutation/Command contracts when it exposes owned mutation;
- Query/read contracts when other owners need direct reads;
- Integration Event contracts when it publishes externally observable committed facts;
- stable public value/DTO contracts only when genuinely required across ownership boundaries.

A system is not required to create empty Command, Query, or Event surfaces when that capability does not exist. Exact package export paths and surface mechanics are governed by ADR-001 and refined in A6.

### 3.3 `orchestration/*` — cross-system policy ownership

`orchestration/*` owns application policy that cannot truthfully belong to one bounded gameplay system because it coordinates multiple mutation authorities or another genuine cross-system concern.

Canonical distinction:

```text
System
= owns a bounded capability

Orchestration
= coordinates bounded capabilities
```

`orchestration/*` is not:

- a global application layer;
- a shared-services bucket;
- a service locator;
- the default home for use cases;
- a place for code with unclear ownership.

Creation rule:

> An orchestration package may be created only when a real cross-system policy/coordination responsibility exists and that responsibility cannot be owned by one system under ADR-001.

A single-authority use case remains inside its owning system even if it performs multiple approved read-only Queries.

### 3.4 `foundation/*` — product-neutral foundation ownership

`foundation/*` owns generic primitives and infrastructure contracts that have **no gameplay ownership**.

Foundation capability test:

> The capability should be explainable without knowing that the product contains Roads, Zones, Buildings, Households, Traffic, or another gameplay domain.

Potential conceptual homes may include contracts, deterministic primitives, runtime infrastructure, persistence infrastructure, event delivery, or spatial primitives, but A3 does not approve any concrete foundation package.

Binding rule:

```text
Used by many systems
!=
Foundation
```

Foundation promotion requires **semantic reuse**, not merely syntactic/code reuse.

A capability must not enter Foundation while it still carries gameplay vocabulary or gameplay ownership.

Examples of concepts that must remain outside Foundation while gameplay-specific include:

```text
Money
RoadId
ZoneType
BuildingId
HouseholdId
traffic-specific state
```

The exact owner of these examples is decided by the relevant current system design; this document only forbids using Foundation as a shortcut.

### 3.5 `testkit/*` — reusable testing infrastructure ownership

`testkit/*` owns reusable support that exists only to improve automated testing across ownership boundaries.

Production code must never depend on `testkit/*`.

```text
production -> testkit   FORBIDDEN
```

System-specific fixtures should remain with their owning system unless genuine cross-package test reuse exists.

`testkit/*` must not become a backdoor shared gameplay implementation layer.

### 3.6 `tests/` — repository-level verification ownership

Top-level `tests/` is reserved for verification whose ownership is larger than one package/system.

Examples include:

- cross-system integration verification;
- browser-dependent behavior;
- critical product journeys;
- visual authority;
- repository-level architecture/integration verification where package-local ownership is insufficient.

Unit, contract, and owner integration tests remain with their owning package by default. Exact placement is refined in A9.

### 3.7 `tooling/` — repository engineering ownership

`tooling/*` owns repository engineering automation such as:

- architecture validation;
- workspace/import graph analysis;
- verification resolution;
- release/development automation;
- repository consistency checks.

Production runtime code must never depend on `tooling/*`.

```text
production -> tooling   FORBIDDEN
```

Tooling may inspect source/package metadata. Source packages must not import tooling back into production behavior.

Architecture knowledge that must be enforceable should live in binding architecture documents and reusable tooling, not solely inside CI YAML.

### 3.8 `docs/` — binding knowledge ownership

Repository-wide architecture belongs under:

```text
docs/architecture/
```

System-owned binding material belongs under:

```text
docs/systems/<system>/
```

No active legacy/archive documentation namespace is maintained under the current Product Architecture.

### 3.9 `.github/` — delivery integration ownership

`.github/` adapts repository workflow to GitHub capabilities such as Actions, pull requests, and issue templates.

It is not architecture authority.

A CI workflow may invoke architecture/verification tooling, but a critical dependency or ownership rule must not exist only as hidden workflow YAML logic.

### 3.10 Repository root — control plane only

The repository root contains workspace/repository control-plane files such as:

```text
package.json
pnpm-workspace.yaml
tsconfig*.json
ESLint/Prettier configuration
LICENSE
README.md
.gitignore
```

Production gameplay/application source must not be placed directly at repository root.

Forbidden examples include:

```text
terrain.ts
game.ts
shared.ts
constants.ts
utils/
simulation/
```

Every production source file must have an architectural owner.

## 4. Ownership placement decision tree

New files/capabilities are classified using this decision tree:

```text
New file / capability
        │
        ▼
Is it executable product shell / entry / concrete product composition?
        │
       YES ──> apps/*
        │
       NO
        ▼
Does it own a bounded gameplay capability?
        │
       YES ──> systems/*
        │
       NO
        ▼
Does it coordinate multiple gameplay mutation authorities
or another genuine cross-system policy?
        │
       YES ──> orchestration/*
        │
       NO
        ▼
Is it a generic primitive/infrastructure capability
with no gameplay semantics?
        │
       YES ──> foundation/*
        │
       NO
        ▼
Is it reusable testing-only support?
        │
       YES ──> testkit/*
        │
       NO
        ▼
Is it repository engineering automation?
        │
       YES ──> tooling/*
        │
       NO
        ▼
Is it binding knowledge/documentation?
        │
       YES ──> docs/*
        │
       NO
        ▼
DO NOT CREATE IT YET
```

This decision tree is intended to become mechanically supported by later architecture tooling where feasible.

An unresolved placement is treated as an unresolved ownership design problem, not as permission to create a generic bucket.

## 5. Package ownership model

Every production file belongs to exactly one workspace/package owner.

Conceptually:

```text
Top-level ownership namespace
        ↓
Workspace package
        ↓
Single architectural owner
```

A canonical gameplay responsibility must not be spread across unrelated packages merely for technical separation.

Default for systems:

```text
systems/terrain
= one Terrain ownership boundary
```

not automatically:

```text
terrain-domain
terrain-application
terrain-three
terrain-utils
```

Technical layers do not automatically justify package boundaries.

## 6. Package creation rule

A new package must answer all of these questions before creation:

```text
What does it own?
Why is this a separate ownership boundary?
Who is allowed to depend on it?
What externally observable contract capability does it need, if any?
How can it be understood/tested independently?
Why can this responsibility not remain inside an existing owner?
```

If these questions cannot be answered clearly, package creation is rejected until the design is clarified.

Empty speculative packages are forbidden.

## 7. Package split, merge, and delete rules

### Split

A package may be split only when current evidence demonstrates a real boundary, such as:

- distinct ownership;
- independent lifecycle;
- incompatible dependency requirements;
- independently meaningful build/performance boundary;
- independently reusable public contract/capability;
- the existing package can no longer be understood/tested coherently as one owner.

A package must not be split merely because:

- it contains many files/classes;
- it uses Three.js;
- it has both domain and presentation code;
- a technical layer could theoretically be a package;
- a split looks cleaner in the tree.

### Merge

Packages should be reconsidered for merge when they:

- have no meaningful independent contract;
- change together almost always;
- cannot be understood/tested independently;
- actually share one authority/ownership boundary.

### Delete

When a capability is retired, remove it from active source.

Do not retain active-source buckets such as:

```text
old/
deprecated/
legacy/
archive/
```

Git history may remain archival under ADR-000, but is not active architecture input.

## 8. Layer-level dependency permission model

Default permissions:

```text
Consumer          apps   orchestration   systems   foundation   testkit   tooling
--------------------------------------------------------------------------------
apps/*            limited      YES          YES         YES         NO        NO
orchestration/*     NO        limited        YES         YES         NO        NO
systems/*           NO          NO           YES*        YES         NO        NO
foundation/*        NO          NO            NO         YES*        NO        NO
production          —           —             —           —          NO        NO
```

`limited` means same-layer dependencies require explicit justification and must not create a hidden second ownership hierarchy.

`YES*` has additional binding rules.

### System-to-system default

The default is:

```text
systems/A -> systems/B   FORBIDDEN
```

A direct system dependency is an explicit exception allowed only when all of these are true:

1. the dependency is required for a read-only Query/public read contract;
2. the target surface is approved by ADR-001/A6;
3. no Command or mutation authority is invoked;
4. the direct system dependency graph remains acyclic;
5. the dependency is reviewed as part of the owning system design/change.

Cross-system mutation is never enabled by a direct system dependency. Mutation of another system belongs through the approved Command/orchestration model in ADR-001.

### Foundation-to-foundation

Foundation packages may depend on other Foundation packages only through deliberate package contracts, and the Foundation dependency graph must remain acyclic.

A dependency between Foundation packages must not be used to hide gameplay semantics.

### Downward dependencies need not be adjacent

An application may depend directly on an approved Foundation contract when legitimate:

```text
apps/game -> foundation/<capability>   ALLOWED
```

The architecture does not require dependency calls to pass artificially through every intermediate namespace.

## 9. Composition-root rule

`apps/game` owns the product-level composition root.

All **concrete cross-package dependency wiring** between systems, orchestration packages, and Foundation implementations must be assembled from the application composition boundary rather than through hidden globals, service locators, or self-registration side effects.

This does not prohibit ADR-001-approved compile-time Query dependencies between system packages. A direct read-contract import is a declared package dependency, not concrete runtime wiring.

When dependency inversion is required to avoid a system package cycle, the consuming package owns its internal port and `apps/game` composition supplies the provider adapter.

Forbidden composition behavior includes:

- a system discovering another system through a global container;
- import-time side effects that register gameplay dependencies implicitly;
- a package constructing another bounded system behind the composition root;
- UI/bootstrap files outside the composition boundary becoming an accidental service locator.

A5/A7 will refine internal composition structure without changing this ownership rule.

## 10. Shared-code promotion rule

Code similarity is not sufficient evidence for shared ownership.

```text
Duplication
!=
Foundation candidate
```

Before promoting code out of an owner, reviewers must ask:

```text
Is this one semantic concept with one stable generic meaning?
or
Does the implementation merely look similar today?
```

If the semantics remain owner-specific, local duplication is preferred over incorrect shared coupling.

Foundation promotion requires semantic reuse with no gameplay ownership.

## 11. Testing ownership baseline

A3 freezes only the ownership baseline:

```text
System unit/contract/owner tests
-> owning systems/<name> package

Cross-ownership repository verification
-> top-level tests/ when package-local ownership is insufficient

Reusable testing-only infrastructure
-> testkit/* when genuinely cross-package reusable
```

Detailed testing topology is deferred to A9.

## 12. Structural anti-pattern checklist

The following are architecture violations unless explicitly superseded by a later approved architecture decision:

- [ ] generic top-level `packages/` ownership bucket;
- [ ] `shared/`, `common/`, `utils/`, or `lib/` catch-all packages;
- [ ] production source directly at repository root;
- [ ] empty packages created for expected future needs;
- [ ] one canonical gameplay authority spread across multiple packages without a justified split;
- [ ] one package per technical layer by default;
- [ ] `apps/*` owning canonical gameplay rules;
- [ ] `orchestration/*` used as a global application/service layer;
- [ ] `foundation/*` containing gameplay ownership/vocabulary merely because many systems use it;
- [ ] production packages depending on `testkit/*`;
- [ ] production packages depending on `tooling/*`;
- [ ] CI YAML being the only source of an architecture rule;
- [ ] active `legacy/`, `old/`, `deprecated/`, or `archive/` source trees;
- [ ] direct system-to-system Command/mutation dependencies;
- [ ] unreviewed direct system-to-system Query dependencies;
- [ ] system dependency cycles;
- [ ] hidden runtime wiring outside the application composition boundary;
- [ ] package creation without a clear owner and independent reason to exist.

## 13. Placement examples / Definition of Done

A3 is considered sufficiently precise when ownership can be determined for representative examples without inventing a generic bucket.

```text
Three.js renderer/bootstrap startup
-> apps/game

RoadNetwork canonical gameplay model
-> systems/roads

BuildRoad single-authority use case
-> systems/roads

Road Query contract used by another owner
-> systems/roads public contract capability

Road Command contract for owned mutation
-> systems/roads public mutation contract capability

RoadBuilt Integration Event contract
-> systems/roads public event contract capability

PurchaseAndBuildRoad coordinating Economy + Roads mutation
-> orchestration/<approved concern>

RoadId
-> systems/roads

generic Result<T, E> with no gameplay meaning
-> foundation/<approved capability>

Money
-> NOT Foundation merely because many systems use it; owner decided by current gameplay design

single-system Roads fixture
-> systems/roads tests/support

generic cross-system deterministic test helper
-> testkit/<approved capability>

workspace dependency/ownership checker
-> tooling/architecture

Road binding specification
-> docs/systems/roads

repository architecture decision
-> docs/architecture

GitHub Actions workflow invoking architecture checks
-> .github/workflows, with the actual ownership rules defined outside YAML
```

## 14. Deferred structure decisions

A3 intentionally does not freeze:

```text
A4 Package Boundary Model
A5 System Internal Structure
A6 Public Export & Dependency Rules
A7 Composition & Orchestration Structure
A8 Foundation Structure
A9 Testing Structure
A10 Documentation Structure
A11 Architecture Enforcement Design
A12 Foundation Bootstrap Structure
```

Runtime/scheduler, persistence/transaction, and ECS/data-oriented behavioral decisions remain outside the current Architecture & Structure focus until this structural sequence is complete.

## 15. Final invariants

```text
Top-level namespaces express ownership.
Every production file has one architectural owner.
One bounded system defaults to one workspace package.
Package boundaries follow ownership, not technical layers.
No generic shared/common/utils ownership bucket.
Foundation contains no gameplay ownership.
Semantic reuse, not code similarity, justifies Foundation promotion.
Orchestration exists only for genuine cross-system policy/coordination.
System-to-system dependency is forbidden by default and read-only by explicit exception.
Cross-system mutation never occurs through direct system dependency.
Concrete cross-package wiring belongs to the apps/game composition root.
Production never depends on testkit or tooling.
Empty speculative packages are forbidden.
Split/merge/delete decisions are evidence-based.
If ownership is unclear, do not create the code/package yet.
```