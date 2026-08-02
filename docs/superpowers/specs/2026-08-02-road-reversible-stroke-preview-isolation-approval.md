# Road Reversible Stroke and Preview Isolation — Approval Record

**Date:** 2026-08-02  
**Status:** Design direction approved; canonical written specification awaiting owner review

## Approved direction

The owner confirmed that Road Preview must apply only to the active stroke and that dragging backward along the same stroke must remove the abandoned tail before commit.

The accepted design direction is:

- ordered, tail-reversible Road pointer traces;
- exact reverse movement pops the active tail;
- branching after reverse commits only the retained path plus the new branch;
- valid and invalid Preview presentation is cell-scoped to the active mutation footprint;
- committed Roads outside the active footprint retain committed styling;
- Build and Bulldoze share the same reversible trace semantics;
- TDD RED/GREEN evidence, Lean CI, focused Chromium checks, and Full CI are required before merge.

The canonical binding contract is:

`docs/superpowers/specs/2026-08-02-road-reversible-stroke-preview-isolation-design.md`

Implementation remains blocked until the owner reviews and approves that written specification.
