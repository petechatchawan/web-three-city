# ADR-0003: Enforce Architecture with Repository-Native Checks First

**Status:** Accepted  
**Date:** `2026-08-07`  
**System:** `architecture-infrastructure`

## Context

Current production imports are acyclic and mostly match package manifests, but architecture enforcement is incomplete. ESLint restrictions cover only selected packages, core packages inherit DOM types through the shared TypeScript base, browser tests use direct source imports, and stale or test-only manifest dependencies exist.

The repository has 18 workspace projects, a small package graph, pnpm scripts, Node `node:test`, and no current dependency graph framework. Introducing Nx or Turborepo before measuring the existing graph would add migration and maintenance cost without proving a need.

## Decision

Build a deterministic repository-native architecture contract test using Node built-ins and the existing manifest/import surface before evaluating a task-orchestration framework.

The check will distinguish:

- production layer violations that fail immediately;
- undeclared workspace imports and dependency cycles;
- deep package imports that bypass `src/index.ts` exports;
- browser-test source imports that require an explicit migration or documented fixture seam;
- ambient DOM-type policy for core packages;
- the AGENTS static Level 2 verification map, which remains separate from the generated architecture graph.

The Node contract test is normative for architecture enforcement. ESLint remains the fast lint surface and may mirror high-signal import restrictions, but a passing ESLint run does not replace the graph contract. The check runs before slow package and browser suites when possible and is registered in the existing repository tooling gate only after the contract's known current-state violations are resolved in the same implementation slice.

## Consequences

### Positive

- Architecture violations fail quickly with repository-native tooling.
- The implementation has no new framework dependency.
- The graph and verification policy remain distinct and understandable to AI agents.
- Migration can be measured before adopting a graph/task framework.

### Negative

- A custom scanner must handle import syntax, workspace aliases, fixtures, and exceptions carefully.
- The scanner itself becomes shared verification tooling and requires Level 3 checks.
- Browser-test direct-source imports require a deliberate migration policy rather than a blanket regex.

## Alternatives Considered

### Nx

Not selected initially. It may provide graph and caching value later, but migration cost and generated configuration are not justified by current graph size.

### Turborepo

Not selected initially. Task caching may help CI, but it does not by itself define the repository's architectural layer rules or transaction ownership.

### ESLint-only restrictions

Insufficient. ESLint can catch selected import patterns but does not reliably derive undeclared workspace dependencies, cycles, manifest drift, or full graph relationships.

### Manual review only

Rejected. The audit found exactly the sort of drift that manual memory-based review misses.

## Enforcement

- Add a Node contract test under `tooling/` before implementation code.
- Run it through `test:deployment` and the Level 3 `pnpm verify` gate.
- Keep forbidden rules explicit and versioned in `AGENTS.md` or the owning system README.
- Cover every current `*-core` package in the scanner; do not rely on the three-package ESLint restriction set as complete coverage.
- Require a same-PR update to the AGENTS static map when a dependency relationship changes consumers.
- Record exceptions with exact paths and reasons; do not create broad allowlists.
- Re-evaluate Nx/Turborepo only after Phase 5 timing and maintenance measurements.

## Supersession

A future graph framework may supersede the scanner only after an ADR compares correctness, migration cost, cache behavior, CI complexity, AI understandability, and solo-developer ergonomics using repository measurements.
