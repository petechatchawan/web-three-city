# Product Architecture Blueprint

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Repository structure, package boundaries, exports, testing, and documentation topology
- **Depends on:** Product Architecture, ADR-000, ADR-001

## Purpose

This Blueprint translates the Product Architecture into a physical repository structure that can be enforced mechanically.

It defines where code belongs, which package surfaces may be imported by which layer, how system dependencies are represented, and where tests/documentation live.

It does not define runtime scheduler behavior, persistence transaction mechanics, or ECS internals; those remain governed by ADR-002, ADR-003, and ADR-004.

## Repository topology

```text
/
├─ apps/
│  └─ game/
│
├─ systems/
│  └─ <system>/
│
├─ orchestration/
│  └─ <concern>/
│
├─ foundation/
│  └─ <capability>/
│
├─ testkit/
│  └─ <capability>/
│
├─ tests/
│  ├─ integration/
│  ├─ browser/
│  ├─ journeys/
│  └─ visual/
│
├─ docs/
│  ├─ architecture/
│  │  └─ adr/
│  └─ systems/
│
└─ tooling/
```

Top-level directories have architectural meaning. The project does not use a generic `packages/*` bucket as the primary architectural namespace.

Empty speculative packages MUST NOT be created merely to make the tree look complete.

## `apps/game`

Owns:

- browser entrypoint;
- product bootstrap;
- composition root;
- UI shell;
- browser/Three.js startup;
- frame/presentation loop wiring;
- dependency injection and adapter wiring.

Does not own:

- canonical gameplay rules;
- hidden cross-system business workflows;
- gameplay persistence authority;
- canonical simulation-time authority.

Recommended initial structure:

```text
apps/game/src/
├─ bootstrap/
├─ composition/
├─ ui/
└─ presentation/
```

The exact subfolders may evolve, but the ownership boundary above is binding.

## `systems/*`

Each package under `systems/*` represents one bounded gameplay authority/capability.

Default non-ECS-oriented package structure:

```text
systems/<system>/
├─ package.json
├─ src/
│  ├─ domain/
│  ├─ application/
│  ├─ contracts/
│  ├─ ports/
│  ├─ presentation/
│  │  └─ three/
│  └─ index.ts
└─ tests/
   └─ integration/
```

This layout is a **default convention, not an absolute internal model**.

ADR-004 may authorize different internal organization for data-oriented or ECS-heavy systems. Such a variation may change internals but MUST preserve:

- package ownership;
- public export rules;
- dependency direction;
- canonical authority rules;
- cross-system communication rules;
- testing and documentation obligations.

In repository terminology, the top-level bounded capability remains a **system**. ECS runtime logic should prefer the term **processor** where practical to avoid collision with the repository-level meaning of system.

Folders that are not needed SHOULD NOT be created empty.

## System internal dependency defaults

For conventional systems:

```text
presentation
     ↓
application
     ↓
domain
```

Additionally:

```text
application -> ports
application -> contracts
domain      -> stable foundation primitives only
```

Domain code MUST NOT depend on:

- Three.js;
- DOM/browser APIs;
- `apps/*`;
- `orchestration/*`;
- another system's internals;
- concrete event-bus implementation;
- concrete persistence implementation.

ADR-004 may vary internal code organization but not these external dependency principles.

## `contracts/` and `ports/`

`contracts/` contains externally observable contract candidates such as:

```text
queries/
commands/
events/
dto/
rejections/
```

A file under `contracts/` is not public until exported through `package.json`.

`ports/` contains dependency-inversion interfaces required by implementation and is internal by default.

Binding rule:

```text
Public read/command contract MUST NOT reference internal ports/* types.
```

A construction-only dependency interface may be deliberately re-exported through `./composition` when required for wiring, but it MUST NOT leak into the read or command surface.

## System package export model

Each system uses three semantically distinct export surfaces when required.

### Read surface — `.`

Example:

```text
@web-three-city/roads
```

May expose:

- queries/query functions;
- read-only DTOs;
- integration-event types;
- stable public value types.

It MUST NOT expose mutation entrypoints.

### Mutation surface — `./commands`

Example:

```text
@web-three-city/roads/commands
```

May expose:

- commands;
- command handlers/application entrypoints intended for orchestration;
- typed command rejections and results needed by callers.

`systems/*` consumers MUST NOT import another system's `./commands` surface.

### Construction surface — `./composition`

Example:

```text
@web-three-city/roads/composition
```

May expose only construction/wiring capabilities such as:

- system factories;
- registration functions;
- composition-only dependency interfaces;
- adapter factories intended for the composition root.

This surface is not a gameplay API.

## Import permission matrix

```text
Consumer          system "."    system "./commands"    system "./composition"
-------------------------------------------------------------------------------
systems/*              YES              NO                      NO
orchestration/*        YES              YES                     NO
apps/*                 YES              YES                     YES
```

Additional rules:

```text
foundation/* -> systems/*        NO
foundation/* -> orchestration/*  NO
foundation/* -> apps/*           NO
systems/*    -> orchestration/*  NO
systems/*    -> apps/*           NO
```

Apps may access command and composition surfaces for UI/application wiring, but cross-system business policy still belongs in orchestration when more than one mutation authority is coordinated.

Deep filesystem imports across package boundaries are forbidden even when TypeScript can resolve them.

## Cross-system query graph

A system may directly depend on another system's root read surface.

The direct system-to-system query dependency graph MUST remain acyclic.

The graph is **derived automatically** from:

```text
workspace/package manifests
+
actual package imports
```

A manually maintained graph file is not architectural authority.

Architecture tooling MUST generate/check the graph and fail if topological sorting detects a direct package cycle.

### Bidirectional pure-read policy

Bidirectional semantic reads may be legitimate, but **bidirectional direct package imports are not**.

Example requirement:

```text
Roads needs Zoning information
Zoning needs Roads information
```

The architecture MUST NOT represent this as:

```text
roads -> zoning
zoning -> roads
```

Instead one direction must be inverted. Typical pattern:

```text
Roads application owns an internal read port
        ↑
apps/game composition wires a Zoning root-query adapter
```

The Roads package therefore does not import the Zoning package for that direction.

This is dependency inversion, not automatically cross-system orchestration, because the use case may still mutate only one canonical authority.

If the adapter requires real business sequencing/policy rather than trivial query translation/wiring, the design must be reconsidered and may belong in an orchestration concern.

No arbitrary fan-out threshold is frozen. Fan-out is observed and addressed when evidence justifies a stronger rule.

## `orchestration/*`

`orchestration/` is a top-level namespace of genuine cross-system concerns, not one mandatory package.

Possible examples:

```text
orchestration/gameplay/
orchestration/persistence/
orchestration/import-export/
```

Packages are created only when real behavior requires them.

A typical orchestration package may use:

```text
src/application/
src/contracts/
src/index.ts
```

It does not own canonical gameplay domain state by default.

## `foundation/*`

Foundation contains generic reusable primitives and infrastructure contracts. It must remain free of gameplay-specific ownership.

Potential capabilities include:

```text
foundation/contracts
foundation/deterministic
foundation/runtime
foundation/event-bus
foundation/persistence
foundation/spatial
```

These names reserve conceptual homes; packages are created only when an approved design needs them.

### Governance matrix

```text
foundation/contracts      Product Architecture + ADR-001
foundation/event-bus      ADR-001 semantics + ADR-003 delivery/durability
foundation/runtime        ADR-002
foundation/deterministic  ADR-002
foundation/persistence    ADR-003
foundation/spatial        Product Architecture + World/Spatial design
```

`foundation/runtime` is not created merely because the Blueprint names it; its minimum behavior must first be frozen by ADR-002.

`foundation/spatial` is expected to arrive with World/Spatial design rather than being created speculatively in Foundation Bootstrap.

Gameplay-specific terms such as Roads, Zoning, Buildings, Households, or Traffic do not belong in foundation semantics.

## Naming policy

The architecture does not automatically split packages into `*-core` and `*-three`.

Preferred package naming follows bounded capability:

```text
@web-three-city/terrain
@web-three-city/roads
@web-three-city/runtime
```

Three.js presentation begins as an internal adapter under the owning system unless evidence justifies a separate package.

A future package split requires a real reason such as independent lifecycle, build/dependency pressure, ownership, reuse, or deployment/testing isolation.

## Testing topology

```text
src/**/*.test.ts
  -> unit/domain/application tests

systems/<system>/tests/
  -> owning-system integration tests

tests/integration/
  -> cross-package/cross-system integration contracts

tests/browser/
  -> browser-dependent behavior only

tests/journeys/
  -> critical player/product journeys

tests/visual/
  -> visual/rendering authority and visual regression
```

A core gameplay rule that requires browser startup to test is an architecture smell unless browser behavior is itself the subject of the test.

## Documentation topology

```text
docs/
├─ architecture/
│  ├─ PRODUCT-ARCHITECTURE.md
│  ├─ PRODUCT-ARCHITECTURE-BLUEPRINT.md
│  ├─ FOUNDATION-BOOTSTRAP.md
│  └─ adr/
│
└─ systems/
   └─ <system>/
      ├─ README.md
      ├─ specs/
      ├─ adr/
      ├─ tdd/
      └─ verification/
```

Repository-wide ADRs are not mixed with system-local ADRs.

## Architecture enforcement requirements

Foundation Bootstrap must eventually make these rules executable.

At minimum tooling must reject:

```text
foundation -> systems/orchestration/apps
systems -> orchestration/apps
system deep import into another package
system -> another system ./commands
system -> another system ./composition
orchestration -> system ./composition
public read/command contract -> internal ports type
system query dependency cycle
domain -> Three.js
domain -> DOM/browser APIs
domain -> concrete event-bus implementation
undeclared package public import
```

Architecture verification must participate in the fast development loop, not only a final release job.

## Selective verification seam

The Blueprint deliberately exposes enough structure for a future affected resolver to distinguish:

- package ownership;
- public surface changes;
- command/composition surface changes;
- dependency edges;
- repository/tooling changes.

The resolver itself is not frozen here. Legacy verification tooling remains reference material under ADR-000.

## Final invariants

```text
Top-level directories carry architectural meaning.
No empty speculative packages.
One bounded gameplay authority per system package.
Default DDD/hexagonal folders are not an ECS prohibition.
Package exports, not folder names, define public API.
"." = read/observe.
"./commands" = mutate.
"./composition" = construct/wire.
System-to-system direct query graph is acyclic.
Bidirectional semantic reads use dependency inversion, not cyclic imports.
No automatic *-core / *-three split.
Testing and documentation locations are predictable from ownership.
```