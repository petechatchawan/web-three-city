# ADR-000 — Clean-Slate Architecture Reset Policy

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Repository-wide
- **Decision type:** Architecture transition and authority policy

## Context

`web-three-city` is being restarted as a clean-slate product architecture in the same repository.

The repository may retain earlier commits for Git continuity, but pre-reset implementation and documentation are not part of the active product architecture. The clean-slate project must be designed from current requirements and current binding documents only.

The goal is to prevent accidental inheritance, migration-by-habit, and agent decisions based on historical implementation details.

## Decision

The project uses a **full clean-slate rewrite with no legacy inheritance**.

The current Product Architecture and current clean-slate code are the only architectural/product authority.

Previous implementation, specifications, tests, package structure, persistence formats, workflow tooling, verification logic, and gameplay decisions are outside the active architecture boundary.

There is no ADOPT / MODIFY / REJECT legacy audit. New systems are designed from current requirements without first reviewing their former implementation.

## No-legacy-inheritance rule

The following are not inputs to current design or implementation:

```text
previous gameplay code
previous system specifications
previous tests and snapshots
previous package boundaries
previous save schemas
previous browser scenarios
previous CI / verification implementation
previous tooling topology
previous gameplay decisions
```

A current decision may coincidentally reach the same conclusion as an earlier implementation. That does not create inheritance or compatibility.

## Historical Git commits

Earlier commits may remain reachable in Git because the repository history is preserved.

They are **archival only**.

Agents and contributors MUST NOT inspect, copy, port, migrate, or use pre-reset implementation/history as design input unless the owner explicitly requests a historical investigation.

An explicit historical investigation is temporary research only. Its result becomes current authority only if separately approved and written into a current specification or ADR.

No legacy reference document, legacy-reference index, or legacy baseline tag is required for normal development.

## Process and tooling

Process/tooling is also designed from current requirements.

Current architecture may choose practices such as:

- trunk-based development;
- exact-head verification;
- clean-worktree evidence;
- verification ladders;
- pre-commit checks;
- CI quality gates.

Those practices are current decisions because they are explicitly approved now, not because an earlier repository version used them.

No former tooling implementation is adopted by default.

## Transition policy

The repository remains the same repository and `master` remains the intended long-term trunk.

The reset MUST NOT require force-pushing or rewriting repository history.

The clean-slate transition branch is temporary:

```text
reset/product-architecture-clean-slate
```

When the clean-slate architecture/bootstrap is ready, it is merged into `master` through the approved repository workflow. After that merge, `master` is the canonical Product Architecture line and normal short-lived branch development resumes.

No separate legacy development line is maintained.

## Compatibility policy

There is no backward-compatibility obligation with pre-reset gameplay, APIs, packages, tests, saves, or internal formats.

Compatibility may be introduced only by an explicit new requirement with a current owner and current specification.

Historical existence alone never creates a compatibility requirement.

## System design rule

A new system design starts from:

```text
current product requirement
  ↓
current architecture
  ↓
current system specification
  ↓
current TDD plan
  ↓
new implementation
```

It does not start with a migration audit of the former system.

## Consequences

Benefits:

- clean separation between old and new product thinking;
- agents cannot silently import outdated assumptions;
- no migration ceremony for systems intentionally being rewritten;
- current documents remain the only binding design source;
- each system can be designed slowly and independently from first principles.

Accepted costs:

- useful historical implementation ideas are not automatically reused;
- previous tests do not provide verification evidence for rewritten behavior;
- tooling and workflow infrastructure must be specified and implemented again from current requirements;
- historical investigation requires explicit owner intent.

## Final invariants

```text
Current Product Architecture is canonical.
There is no legacy inheritance.
There is no mandatory legacy audit.
Pre-reset commits are archival only.
Agents do not inspect historical implementation unless the owner explicitly asks.
Former tooling is not adopted by default.
Previous compatibility is not a requirement.
The reset branch is temporary; master remains the long-term trunk.
Git history may remain without becoming product authority.
```