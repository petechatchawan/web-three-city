# ADR-000 — Clean-Slate Architecture Reset and Legacy Reference Policy

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Repository-wide
- **Decision type:** Architecture transition and authority policy

## Context

`web-three-city` previously contained a verified city-builder implementation on `master@7b5627ac824c1d9b98f922cf0e95733d66c591d6`, including gameplay systems, presentation packages, tests, workflow tooling, and frozen system specifications.

The product is now being rebuilt on a clean-slate architecture line. Git history is retained so proven ideas and implementation lessons remain available, but the new architecture must not silently inherit gameplay authority, package boundaries, persistence formats, or system contracts from the former implementation.

At the same time, process and tooling conventions are not gameplay authority. Repeating useful workflow design merely because gameplay architecture was reset would add cost without architectural value.

## Decision

The project uses a **full clean-slate rewrite inside the same repository and Git history**.

The new Product Architecture is the canonical product architecture. The former implementation on `master@7b5627ac824c1d9b98f922cf0e95733d66c591d6` is a historical and research reference.

No legacy gameplay artifact has an automatic right to survive.

## Legacy classification

Legacy material is classified into two categories.

### 1. Domain and gameplay material

Examples include:

- Terrain, Roads, Zoning, Buildings, RCI, Growth, Economy, Traffic, Water and Simulation implementation;
- `*-core` / `*-three` package boundaries;
- gameplay APIs and contracts;
- save schemas and persistence structures;
- gameplay browser scenarios and system tests;
- frozen gameplay/system specifications such as Terrain Production specifications.

These are **reference only** until explicitly reviewed by the new owning system.

Every reused domain/gameplay decision must be classified as:

```text
ADOPT
MODIFY
REJECT
```

The result of that review must be captured in the new system's binding specification or ADR.

Therefore:

```text
Legacy code             != canonical implementation
Legacy frozen spec      != current binding contract
Legacy passing tests    != current verification evidence
Legacy package boundary != required current package boundary
Legacy save format      != compatibility requirement
```

### 2. Process and tooling conventions

Examples include:

- trunk-based development principles;
- verification ladder principles;
- exact-head release evidence;
- clean-worktree release evidence;
- GitHub PR/Issue workflow conventions;
- CI quality-gate discipline;
- Husky / pre-commit conventions;
- Development Workflow documentation conventions.

These are **adopted by default** unless they conflict with the Product Architecture or current repository topology.

Default adoption is semantic, not byte-for-byte. A tooling implementation that encodes obsolete package names, dependency graphs, or gameplay topology must be adapted or replaced even when the underlying workflow principle remains adopted.

In particular, legacy selective-verification code under `master@7b5627ac.../tooling/verification/` is historical reference for the future Selective Verification ADR; its old static/topology assumptions are not current architectural authority.

## Transition policy

The repository remains the same repository and `master` remains the long-term default branch.

The transition MUST preserve history and MUST NOT rewrite `master` through force-push.

Before the clean-slate architecture line is merged, the legacy baseline SHOULD be protected by an immutable tag pointing to:

```text
7b5627ac824c1d9b98f922cf0e95733d66c591d6
```

Recommended tag intent:

```text
legacy/pre-product-architecture-reset
```

The clean-slate branch is merged through normal pull-request history. After that merge, `master` becomes the canonical Product Architecture line.

Current canonical reset branch:

```text
reset/product-architecture-clean-slate
```

This reset branch is a temporary transition/integration branch. After the architecture reset is merged, normal trunk-based short-lived branch policy resumes from `master`.

Any earlier reset branch name is superseded and MUST NOT receive new architecture work.

## Compatibility policy

There is no general backward-compatibility requirement with the former gameplay implementation.

Compatibility may be reintroduced only through an explicit current decision, for example:

- importing a legacy save for migration purposes;
- reusing a proven Terrain reconstruction rule;
- retaining a verification workflow principle;
- preserving a public external format that has a real consumer.

Such reuse must be deliberate and documented. Absence of an explicit current decision means no compatibility obligation exists.

## System redesign rule

When a new system is designed, its design packet SHOULD include a short legacy-reference audit when meaningful:

```text
Legacy material reviewed
  -> ADOPT
  -> MODIFY
  -> REJECT
```

This audit is evidence, not authority. The new system specification is the authority.

## Consequences

Benefits:

- no silent inheritance of old architecture;
- no ambiguity about whether old frozen gameplay specs still bind the new implementation;
- useful workflow discipline survives without forcing a needless workflow redesign;
- Git history remains available for research and regression lessons;
- migration decisions become explicit and reviewable.

Accepted costs:

- domain systems must deliberately re-evaluate useful legacy decisions;
- former verification evidence cannot prove correctness of rewritten systems;
- some process tooling must be adapted because the new package topology is different.

## Final invariants

```text
New Product Architecture is canonical.
Legacy gameplay is reference until explicitly re-adopted.
Process/tooling conventions are adopted by default unless incompatible.
Default process adoption is semantic, not byte-for-byte.
No force-push reset of master.
The reset branch is temporary; master remains the long-term trunk.
Git history remains available as evidence and research.
No legacy artifact silently overrides a current specification or ADR.
```