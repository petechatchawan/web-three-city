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

## Economy/RCI Authority Audit

The first audit covers the three pilot specs below. The audit was completed
before the first replacement RED. The migration rule is to remove only a
duplicated deterministic assertion after its lower-layer authority is GREEN;
DOM, browser interaction, responsive layout, and visible save/load behavior
remain in Playwright.

| Spec / test | Deterministic or application proof | Browser authority | Classification | Action |
|---|---|---|---|---|
| `economy.@rci@interaction@smoke.spec.ts` — compact municipal budget | Economy view values are derived from the Economy snapshot; the projection is already covered by `economy-budget-hud.test.ts`. | Dialog DOM, compact layout, visible tool containment | `BROWSER_CONTRACT_KEEP` | Keep the browser test; no migration in slice 1. |
| `economy.@rci@interaction@smoke.spec.ts` — typed tax policy and save round-trip | Accepted typed policy, one committed-world revision, and custom tax policy surviving WorldSaveV8 | Select/click/status, browser storage save, Load action, and visible restored value | `MIXED_SPLIT` | Replace only duplicated command/save-state assertions after lower-layer GREEN. |
| `city-ui-dialogs.@rci@interaction.spec.ts` — Economy dialog refresh and tax | Absolute-minute stepping and typed command are deterministic/application concerns; dialog refresh and active-tool continuity are UI/application integration. | City dialog navigation, time API interaction, status, active tool and responsive DOM | `MIXED_SPLIT` | Keep for now; not part of slice 1. |
| `rci.@rci@smoke.spec.ts` — demand bars and City values | RCI HUD model values are covered by `rci-hud.test.ts`. | Demand-bar DOM, ARIA labels, City dialog copy and layout | `BROWSER_CONTRACT_KEEP` | Keep the browser authority. |
| `rci.@rci@smoke.spec.ts` — background ticks and active zoning | Tick/tool relationship is application behavior, but the browser timer and active tool journey are integrated evidence. | Real browser timing, tool ownership, and DOM state | `MIXED_SPLIT` / `CRITICAL_E2E_KEEP` | Keep; no narrowing in slice 1. |
| `rci.@rci@smoke.spec.ts` — WorldSaveV8 round-trip | Canonical save schema and state equality are application integration candidates. | localStorage, Save/Load controls, visible post-load City values | `MIXED_SPLIT` | Audit for a later slice; retain browser journey now. |

### Slice 1 — Economy tax policy and WorldSaveV8

The first replacement authority is owned by `apps/game` application tests,
because it covers the committed-world transaction and WorldSaveV8 boundary:

`apps/game/src/application/economy-browser-replacement.test.ts`

It proves these deterministic cases:

- `typed-tax-policy-command` — typed tax policy is accepted and published as
  one world revision with the expected Economy policy;
- `world-save-tax-policy` — the custom policy and Economy revision survive a
  WorldSaveV8 encode/decode round-trip.

The corresponding Playwright test retains the real UI interaction, browser
storage, Save/Load journey, and visible restored tax selection. Only the
duplicated serialized-state assertion is eligible for narrowing after the
replacement authority is GREEN.

### Slice 1 TDD evidence

- RED: replacement matrix expected `typed-tax-policy-command` and
  `world-save-tax-policy`, received `[]`.
- GREEN: both executable replacement cases pass, with the inventory contract
  passing for `3/3` tests.

The exact Game Vitest inventory is now `95` files / `384` tests. The increase
from the PR-T4 baseline of `94` files / `381` tests is the intentional Economy
replacement authority test; the topology guard remains strict equality.

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
