# <Change or Milestone> — Design Specification

**Status:** Draft | Approved | Implemented | Superseded  
**System:** `<system>`  
**Date:** `YYYY-MM-DD`

## Decision Summary

Summarize the approved behavior and the architectural direction in a few paragraphs.

## Context

Explain the current state and the problem this change addresses.

## Goals

- Concrete outcomes that must exist after implementation.

## Non-Goals

- Adjacent work explicitly excluded from this change.

## System Boundary

State ownership, dependencies, inputs, outputs, and what remains in neighboring systems.

## Authoritative and Derived State

Identify the single source of truth and data that can be reconstructed.

## Main Workflows

Describe canonical order, transaction boundaries, validation, and failure behavior.

## Data and Contracts

Include only contracts that are necessary to remove ambiguity. Link to source after implementation.

## Persistence and Migration

State schema changes, defaults, validation, and continuous-run versus save/load equivalence.

## Determinism and Performance

State stable ordering, seeds, fixed-point rules, evaluation cadence, and expected scale.

## Extension Points

Describe seams required by known future systems without building a generic framework.

## Acceptance Criteria

- Observable behavior and testable invariants.

## PR Decomposition

List independently reviewable delivery slices.

## Related Documents

- System overview:
- ADRs:
- TDD plan:
- Verification:
