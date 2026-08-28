# Foundation Bootstrap

- **Status:** REVIEWED DESIGN BASELINE — PENDING A12 RECONCILIATION
- **Date:** 2026-08-28
- **Scope:** Initial executable architecture scaffold
- **Depends on:** Product Architecture, ADR-000, ADR-001

## Current authority note

This document predates the A3–A12 Architecture & Structure sequence.

The current structural proposal for Bootstrap is:

```text
docs/architecture/FOUNDATION-BOOTSTRAP-STRUCTURE.md
```

This file remains a **non-binding reviewed baseline** during the A5–A12 batch review only.

Before any Bootstrap implementation planning begins, this document MUST be reconciled with A12 or superseded/merged so the repository has one primary Bootstrap authority.

It is not implementation authorization.

## Purpose

Foundation Bootstrap is the first executable architecture scaffold for the clean-slate repository. It is not a gameplay milestone.

The intended scaffold exists to prove repository structure, package boundaries, composition, current process/tooling, and minimal browser startup without introducing speculative gameplay systems.

## Binding deferral

All detailed structure in this baseline is subordinate to the A3–A12 architecture contracts once approved.

Do not implement from this file alone.

The active review set determines:

```text
repository topology
package boundaries
system internals
public exports/dependency permissions
composition/orchestration structure
Foundation structure
testing structure
documentation structure
architecture enforcement
Bootstrap structure
```

## Non-goals

Bootstrap does not define or implement:

```text
World
Terrain
Terraform
Roads
Zoning
Buildings
Households
Economy
RCI
Mobility
Traffic
Water
runtime scheduler semantics
production persistence/save schema
ECS runtime
visual fidelity work
```

No gameplay package is created merely to demonstrate architecture.

## Current process/tooling direction

The current design expects a modern TypeScript web workspace with local/CI verification and architecture checks designed from current requirements only.

Potential toolchain family:

```text
Node.js 22+
pnpm
TypeScript
Vitest
ESLint
Prettier
Playwright
Husky
GitHub Actions
Three.js at application/presentation boundary
```

Exact versions, scripts, and implementation sequence remain implementation-plan decisions after A12 reconciliation and batch approval.

## Current blocking gate

Implementation is blocked until:

```text
A5–A12 batch review is complete
A5–A12 documents are revised/frozen as approved
this baseline is reconciled/superseded against A12
an implementation/TDD plan is reviewed
```

## Final note

This document is intentionally concise during the batch review to avoid maintaining two competing detailed Bootstrap specifications.

`FOUNDATION-BOOTSTRAP-STRUCTURE.md` is the document to review for the current A12 structural proposal.