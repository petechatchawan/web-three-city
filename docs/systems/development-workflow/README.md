# Development Workflow System

**Status:** Approved design — not implemented  
**System:** Development Workflow  
**Primary ownership:** repository root configuration, `.github/`, `AGENTS.md`, and development documentation  
**Persistence:** Git-tracked repository configuration and documentation only

## Purpose

Define the repository-owned development loop for humans and AI agents so changes can be located, implemented, verified, documented, and merged with fast feedback without weakening final safety gates.

The system owns development commands, verification escalation policy, pre-commit automation, AI onboarding guidance, GitHub contribution templates, trunk policy, and workflow documentation consistency.

## Current State

The v0.1 design is approved but not yet implemented. The current repository still has the legacy workflow characteristics that motivated this milestone:

- root verification defaults to repository-wide commands;
- there is no root `AGENTS.md`;
- there is no Husky/lint-staged pre-commit guard;
- there is no structured bug Issue Form or repository PR template;
- `docs/development-workflow.md` still describes a `develop` integration branch that no longer exists;
- `docs/systems/README.md` still contains stale RCI registry status.

Until the implementation PR is merged, existing repository commands and CI remain authoritative.

## Approved Direction

Development Workflow System Improvement v0.1 will establish:

1. package-targeted verification as the default AI inner loop;
2. an explicit Level 0–4 verification ladder with a static downstream escalation map;
3. Prettier auto-fix plus Husky/lint-staged staged-file formatting and ESLint fixes;
4. a single root `AGENTS.md` as the AI onboarding and execution authority;
5. a GitHub YAML bug Issue Form and PR template tied directly to `AGENTS.md` verification rules;
6. same-PR Definition of Done for behavior and living documentation, with an explicit exact-head CI evidence exception;
7. `master` as the always-releasable trunk with short-lived branches;
8. repair of stale workflow and system-registry documentation.

## Non-Responsibilities

v0.1 intentionally does not refactor `apps/game/src/game-bootstrap.ts`, add an application layer, add Nx/Turborepo, implement automatic affected-graph tooling, shard the browser suite, redesign package boundaries, or add gameplay systems.

## Documentation Authority

- Approved design: [Development Workflow System Improvement v0.1](specs/2026-08-07-development-workflow-system-improvement-v0-1.md)
- Current legacy workflow until implementation: [`docs/development-workflow.md`](../../development-workflow.md)
- System registry: [`docs/systems/README.md`](../README.md)

After v0.1 implementation, this README becomes the concise current-state handoff and the legacy workflow document must be updated or reduced to a compatible entry point rather than retaining contradictory branch or verification rules.
