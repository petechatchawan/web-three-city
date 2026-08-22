# PR-T5 — Economy/RCI Deterministic Proof Migration Pilot

## Status

Approved to start after PR-T4 Solo Maintainer Gate passed.

Parent exact HEAD: `c4bf2c03a9e38afa88615aef9729c85b97eca270`.

## Goal

Apply the proven Road/Traffic replacement-first testing pattern to Economy and RCI while using PR-T4 affected execution as the verification path.

Core rule:

```text
browser assertion audit
→ lower-layer RED
→ lower-layer GREEN
→ narrow only duplicated Playwright proof
→ affected execution verification
```

Move proof downward, not coverage downward.

## Candidate Lower-Layer Authority

Audit current Playwright assertions for deterministic proof such as:

- Economy policy/state transitions.
- RCI demand and tick state.
- Save/load semantic state where browser storage behavior is not the authority under test.
- No-mutation application assertions that do not depend on DOM, CSS, browser input, canvas, or WebGL.

Do not assign ownership mechanically. Deterministic domain rules belong in their owning core package; cross-system/application orchestration belongs in the appropriate non-browser integration layer.

## Browser Hard Keeps

Retain Playwright authority for:

- responsive/mobile layout and overflow.
- DOM/CSS bounds and dialog behavior.
- localized EN/TH copy.
- browser-visible RCI demand bars and HUD presentation.
- real browser interaction semantics.
- browser save/load acceptance when localStorage/browser adapter behavior is material.
- visual evidence and any browser/Three.js behavior.

## TDD Contract

For each migrated assertion:

1. identify the current browser assertion and its intended lower-layer owner.
2. write the replacement test first.
3. verify an intended RED failure.
4. make or confirm GREEN without weakening semantics.
5. only then narrow the duplicated Playwright assertion.
6. keep mixed tests when they still own browser/UI authority.

No numerical browser-test reduction target is allowed.

## Verification

Use PR-T4 changed-source affected execution.

Expected verification is derived from changed-file ownership and risk rather than manually broadening the suite. Full Browser remains escalation-only when the affected execution plan classifies the change as shared/global authority.

Final evidence must include one exact HEAD for owner tests, affected consumers, browser authority, Sonar when applicable, and clean worktree verification.

## Non-Goals

- No Economy or RCI gameplay redesign.
- No UI redesign.
- No unrelated system migration.
- No CI worker/retry/timeout changes.
- No performance-authority migration.
- No weakening or disabling browser assertions to reduce runtime.

## Stop Conditions

Stop and report before browser narrowing if a lower-layer RED reveals a genuine production defect rather than missing replacement authority.

Keep this PR Draft until Economy/RCI migration evidence, exact-head verification, and AI technical review pass.
