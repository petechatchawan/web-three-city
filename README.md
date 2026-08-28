# Web Three City

Clean-slate Three.js city-builder repository. The current executable baseline is intentionally a **Foundation + Architecture + Structure scaffold**, not a gameplay milestone.

## Current scope

The active scaffold contains exactly three workspace packages:

```text
apps/game
foundation/contracts
tooling/architecture
```

Their responsibilities are deliberately narrow:

- `@web-three-city/app-game` — executable browser shell, product composition boundary, UI shell, and Three.js presentation startup.
- `@web-three-city/foundation-contracts` — generic Command result/rejection and Integration Event contract primitives governed by ADR-001.
- `@web-three-city/tooling-architecture` — deterministic machine enforcement for mechanically observable A3–A11 architecture rules.

There are currently **no gameplay systems**. Terrain, Roads, Zoning, Buildings, Economy, runtime scheduling, persistence, ECS/data-oriented behavior, and World/Spatial semantics remain outside this Bootstrap.

## Architecture authority

Repository-wide architecture is under `docs/architecture/`. The active sequence A3–A12 is frozen and the single Bootstrap structural authority is:

```text
docs/architecture/FOUNDATION-BOOTSTRAP-STRUCTURE.md
```

The implementation plan is:

```text
docs/superpowers/plans/2026-08-28-foundation-architecture-structure-bootstrap.md
```

Chat history and pre-reset implementation are not architecture authority.

## Ownership topology

```text
apps/*           executable product boundaries
systems/*        bounded gameplay capabilities (created only after system approval)
orchestration/*  genuine multi-authority policies (created only when required)
foundation/*     gameplay-neutral lower-level capabilities
testkit/*        reusable test-only capabilities
tests/*          repository-level integration/browser/journey/visual verification
tooling/*        repository engineering and architecture enforcement
docs/*           binding architecture/system knowledge
```

Generic ownership buckets such as `packages/`, `shared/`, `common/`, and `utils/` are not part of the architecture.

## Package boundary model

All workspace packages use the same encapsulated-package model:

```text
internal by default
package.json exports = mechanical public visibility
no cross-package deep imports
all direct dependencies declared
exported != permitted for every consumer
no mutable internal state ownership crossing package boundaries
```

For future gameplay systems, public surfaces are semantically separated as:

```text
"."              read / observe
"./commands"     mutate
"./composition"  construct / wire
```

The architecture checker validates these rules using current manifests/imports plus narrow approved exceptions in `architecture.policy.json`. That policy file is **not** a manually maintained dependency graph.

## Toolchain

The Bootstrap pins its execution baseline in `package.json` and workspace package manifests:

```text
Node.js     22.18.0
pnpm        10.15.1
TypeScript  5.9.2
Vitest      3.2.4
Vite        7.1.3
Three.js    0.179.1
Playwright  1.55.0
```

Additional lint/format/tooling versions are also pinned exactly in manifests and the lockfile.

## Commands

Install dependencies:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
```

Focused commands:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm architecture:check
pnpm build
pnpm test:browser
```

Full repository verification:

```bash
pnpm exec playwright install chromium
pnpm verify
```

`pnpm verify` is the local equivalent of the CI acceptance sequence after Chromium is installed.

## Architecture enforcement

`tooling/architecture` derives facts from the current repository rather than a copied topology map. It checks, among other things:

- workspace package ownership namespace and default naming;
- `package.json` export visibility and deep-import violations;
- undeclared or misclassified dependencies;
- system read/command/composition permissions;
- reviewed production system Query edges and Query cycles;
- Foundation upward dependencies and dependency cycles;
- testkit privilege restrictions;
- repository-level test public-surface permissions;
- obvious public contract leaks into private ports/implementation paths;
- system-domain outward/Three.js/browser-global violations;
- selected FROZEN-document status/placeholder rules.

Diagnostics have stable rule IDs and deterministic ordering. Semantic questions such as whether a concept truly belongs in Foundation remain architecture-review responsibilities rather than pretending static analysis can prove them.

## Tests

The Bootstrap verification layers are intentionally small:

```text
foundation/contracts/tests
  -> generic public contract behavior/types

tooling/architecture/tests + fixtures
  -> valid/invalid architecture rule behavior

tests/browser
  -> actual browser application bootstrap / Three.js presentation seam
```

Browser tests do not prove gameplay correctness, and no fake gameplay packages exist merely to exercise architecture tooling.

## Pre-commit and CI

The Husky pre-commit hook runs fast structural feedback:

```text
format:check
lint
architecture:check
```

CI independently performs full verification. GitHub Actions contains orchestration only; architecture rule semantics remain in `tooling/architecture`.

## Explicit non-goals of this scaffold

Do not add any of the following merely to make the repository look complete:

```text
systems/terrain
systems/roads
orchestration/gameplay
foundation/runtime
foundation/deterministic
foundation/event-bus
foundation/persistence
foundation/spatial
testkit/* placeholders
```

Each future package requires its current governing architecture/system design and A3 creation gate before it exists.
