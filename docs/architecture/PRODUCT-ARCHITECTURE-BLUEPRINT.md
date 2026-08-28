# Product Architecture Blueprint

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Repository structure, package boundaries, exports, testing, and documentation topology
- **Depends on:** Product Architecture, ADR-000, ADR-001

## Purpose

This Blueprint translates the Product Architecture into a physical repository structure that can be enforced mechanically.

It defines where code belongs, which package surfaces may be imported by which layer, how system dependencies are represented, and where tests/documentation live.

Detailed structural contracts are now being refined under the Architecture & Structure sequence:

```text
A3 Repository Topology & Ownership Model                 FROZEN
A4 Package Boundary Model                                FROZEN
A5 System Internal Structure                             REVIEW DRAFT
A6 Public Export & Dependency Rules                      REVIEW DRAFT
A7 Composition & Orchestration Structure                 REVIEW DRAFT
A8 Foundation Structure                                  REVIEW DRAFT
A9 Testing Structure                                     REVIEW DRAFT
A10 Documentation Structure                              REVIEW DRAFT
A11 Architecture Enforcement Design                      REVIEW DRAFT
A12 Foundation Bootstrap Structure                       REVIEW DRAFT
```

Where a frozen A3/A4 document is more specific than this Blueprint, the more specific frozen contract governs. A5–A12 remain proposals until batch approval.

It does not define runtime scheduler behavior, persistence transaction mechanics, or ECS internals; those remain future behavioral architecture work.

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

A3 is the binding ownership/topology contract.

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

The exact subfolders may evolve, but the ownership boundary above is binding. A7 provides the current detailed composition proposal.

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
│  └─ composition/
└─ tests/
```

This layout is a **default convention, not an absolute internal model**.

A5 is the detailed current proposal for system internals. Alternate data-oriented/ECS-heavy internals may vary structure after later approval while preserving package ownership, public exports, dependency direction, canonical authority, cross-system communication, testing, and documentation obligations.

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
domain      -> approved stable Foundation primitives only
```

Domain code MUST NOT depend on:

- outer contracts/application/ports/presentation/composition layers;
- Three.js;
- DOM/browser APIs;
- `apps/*`;
- `orchestration/*`;
- another system's internals;
- concrete event-bus implementation;
- concrete persistence implementation.

A5 refines these defaults while remaining non-frozen until batch approval.

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
- intended mutation entrypoints;
- typed command rejections and results needed by callers.

Production `systems/*` consumers MUST NOT import another system's `./commands` surface.

### Construction surface — `./composition`

Example:

```text
@web-three-city/roads/composition
```

May expose only construction/wiring capabilities such as:

- system factories;
- registration functions;
- construction-only dependency interfaces;
- adapter factories intended for the composition root.

This surface is not a gameplay API.

A6 is the current detailed export/dependency proposal and distinguishes production consumers from repository-level test code.

## Production import permission matrix

```text
Consumer          system "."    system "./commands"    system "./composition"
-------------------------------------------------------------------------------
systems/*              YES*             NO                      NO
orchestration/*        YES              YES                     NO
apps/*                 YES              YES                     YES
foundation/*           NO               NO                      NO
```

`YES*` is an explicitly reviewed read-only Query exception, not default permission to add arbitrary system edges.

Repository-level test code may use deliberately exported public mutation/composition surfaces for isolated verification under the current A6/A9 review proposal, without receiving private/deep-import access.

Additional rules:

```text
foundation/* -> systems/*        NO
foundation/* -> orchestration/*  NO
foundation/* -> apps/*           NO
systems/*    -> orchestration/*  NO
systems/*    -> apps/*           NO
production   -> testkit/*        NO
production   -> tooling/*        NO
```

Deep filesystem imports across package boundaries are forbidden even when TypeScript can resolve them.

## Cross-system query graph

A system may directly depend on another system's root read surface only as an explicitly reviewed exception.

The direct production system-to-system Query dependency graph MUST remain acyclic.

The graph is derived automatically from workspace manifests and actual production imports; a separately maintained manual graph is not authority.

When semantic reads are bidirectional, one direction uses consumer-owned dependency inversion wired by `apps/game` composition rather than cyclic package imports.

## Foundation

Foundation is not a shared-code bucket.

Reserved conceptual homes currently include:

```text
foundation/contracts
foundation/deterministic
foundation/runtime
foundation/event-bus
foundation/persistence
foundation/spatial
```

Reservation does not authorize package creation.

A8 defines the current creation-gate proposal. Only `foundation/contracts` is currently governed enough by ADR-001 to be a candidate for initial Bootstrap creation; the other reserved homes remain blocked by their future governing designs.

## Testing topology

Default ownership structure:

```text
src/**/*.test.ts
        package-focused tests

<package>/tests/
        package contract/integration

tests/integration/
        cross-package integration

tests/browser/
        browser-dependent behavior

tests/journeys/
        small critical product journeys

tests/visual/
        visual authority/regression

tooling/architecture/tests + fixtures
        architecture checker verification
```

A9 is the current detailed testing proposal. Browser tests remain targeted rather than the default correctness layer.

## Documentation topology

```text
docs/
├─ architecture/
│  ├─ PRODUCT-ARCHITECTURE.md
│  ├─ PRODUCT-ARCHITECTURE-BLUEPRINT.md
│  ├─ structural contracts
│  └─ adr/
└─ systems/
   └─ <system>/
      ├─ README.md
      ├─ specs/
      ├─ adr/
      ├─ tdd/
      └─ verification/
```

A10 is the current detailed documentation proposal. Chat history is not canonical authority.

## Architecture enforcement

A11 proposes a dedicated `tooling/architecture` package that derives the current graph from workspace configuration, manifests, export maps, and source imports.

Mechanical rules include rejecting at least:

```text
foundation -> systems/orchestration/apps
systems -> orchestration/apps
system deep import into another package
system -> another system ./commands
system -> another system ./composition
orchestration -> system ./composition
public read/command contract -> internal ports type
unreviewed direct system root-read dependency
direct production system Query dependency cycle
system domain -> Three.js
system domain -> DOM/browser APIs
production -> testkit/tooling
undeclared package public import
```

Architecture checks must run in the fast development/owner loop, not only a final repository gate.

## Bootstrap structure

A12 proposes an intentionally minimal executable scaffold:

```text
apps/game
foundation/contracts
tooling/architecture
repository control-plane files
minimal tests/CI only when real files exist
```

No gameplay package or blocked Foundation capability is pre-created merely to prove structure.

The existing `FOUNDATION-BOOTSTRAP.md` remains a non-binding reviewed baseline during this batch and must be reconciled/superseded against A12 before implementation planning.

## Package naming policy

Default ownership-revealing identities:

```text
systems/<name>        -> @web-three-city/<name>
apps/<name>           -> @web-three-city/app-<name>
orchestration/<name>  -> @web-three-city/orchestration-<name>
foundation/<name>     -> @web-three-city/foundation-<name>
testkit/<name>        -> @web-three-city/testkit-<name>
tooling/<name>        -> @web-three-city/tooling-<name>
```

Actual package creation still requires A3 ownership justification.

## Current Architecture & Structure review gate

A5–A12 are intentionally being reviewed as one batch.

Until the batch is approved:

```text
A3/A4 remain frozen
A5–A12 remain REVIEW DRAFT — NOT FROZEN
no Bootstrap implementation begins
no gameplay package is created
```

After approval, the batch is revised/frozen together, Bootstrap authority is reconciled, and only then may implementation planning begin.

## Final invariants

```text
Top-level namespaces express ownership.
Package exports, not folder visibility, define public API.
Everything is internal by default.
"." = system read/observe.
"./commands" = system owned mutation.
"./composition" = construct/wire.
Production system-to-system direct Query graph is reviewed and acyclic.
Bidirectional semantic reads use dependency inversion, not cyclic imports.
Package boundaries split only when current ownership evidence justifies it.
Foundation is semantic generic reuse, not shared code by convenience.
Testing and documentation locations are predictable from ownership.
Architecture structure is mechanically enforceable where observable.
No pre-reset architecture or tooling is an input to the current Blueprint.
```