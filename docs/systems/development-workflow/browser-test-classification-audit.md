# Browser Test Classification Audit — PR-T3.1

**Status:** Audit only — no migration authorized  
**System:** Development Workflow  
**Parent:** PR-T2 Verification Infrastructure Foundation  
**Audit base:** `e6b956c37835f1fc617587001ebd6e79eff6e0a2`

## Purpose

PR-T3.1 answers one question before any browser-test migration begins:

> Which assertions require a real browser / Three.js runtime, and which assertions are deterministic proof currently executed in a browser only because that is where the test was written?

The governing rule is:

> **Move proof downward, not coverage downward.**

This PR does not migrate, delete, rewrite, skip, retag, or reduce any Playwright test. A future migration may remove a browser assertion only after an equal-or-stronger lower-layer replacement is GREEN and the remaining browser authority is explicit.

## Frozen baseline

The repository topology contract at the audit base freezes:

- **33 Playwright spec files** in `browser-tests/`.
- **148 Chromium tests** in the full Playwright project.
- Chromium has no full-project tag exclusion.
- Browser ownership tags remain repository policy.

The Road / Traffic pilot is detailed separately in `road-traffic-browser-audit.md` and accounts for **60 tests**. The other **88 tests** remain browser-authoritative during PR-T3.1; this audit records their primary authority class but does not authorize migration.

## Classification model

| Category | Authority | Typical examples | Default future action |
|---|---|---|---|
| `DOMAIN_LOGIC_CANDIDATE` | deterministic domain state/rules | validation, compatibility, pure calculation, state transition | move proof to Vitest unit coverage after RED/GREEN replacement |
| `APPLICATION_INTEGRATION` | deterministic cross-system/application coordination | service orchestration, persistence transforms, committed-world transitions | move proof to Vitest integration where browser APIs are not material |
| `BROWSER_CONTRACT` | browser DOM/CSS/accessibility/layout | responsive bounds, modal behavior, locale/accessibility copy | keep browser authority |
| `THREEJS_INTEGRATION` | canvas/Three.js/WebGL/input/world mapping | pointer capture, raycast, camera, render roots, WebGL lifecycle | keep browser authority |
| `CRITICAL_E2E` | bounded user journey | build/inspect/save/load/recovery journey | keep a small representative journey set |
| `EVIDENCE_PERFORMANCE` | visual/performance evidence | screenshot evidence, rAF/frame sampling, presentation caps | keep browser evidence |

`Full Regression` is an execution profile, not a classification layer.

## Classification rules

1. Classify by the **fact that requires authority**, not by the test runner currently used.
2. DOM/CSS/layout/accessibility facts remain browser facts.
3. Canvas pointer mapping, camera behavior, scene/render-root behavior and WebGL lifecycle remain Three.js/browser facts.
4. Pure road topology, compatibility, lifecycle, routing, reservation and persistence-transform rules should not require Chromium merely to execute deterministic code.
5. A test that mixes lower-layer proof with real browser authority is a **split candidate**. The browser journey remains until lower proof is GREEN; then the browser test may be narrowed, not blindly deleted.
6. Visual and performance evidence is intentionally browser-owned even when adjacent logical assertions move lower.
7. Uncertain cases fail safe: keep browser authority until a future RED/GREEN migration proves otherwise.

## Full spec inventory

The table assigns the primary authority of each current spec. For the Road / Traffic pilot, the companion audit classifies every generated/current test case in detail. For non-pilot specs, this is a conservative file-level authority map; no migration is authorized from this table alone.

| Spec | Primary authority | PR-T3.1 disposition |
|---|---|---|
| `building.@building@smoke.spec.ts` | `CRITICAL_E2E` | keep; later inspect deterministic building assertions for split candidates |
| `building.@building@visual@release.spec.ts` | `EVIDENCE_PERFORMANCE` | keep browser evidence |
| `citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts` | `CRITICAL_E2E` | detailed pilot audit; split candidate |
| `citizen-mobility-traffic-mobile-regression.@traffic@interaction@release.spec.ts` | `BROWSER_CONTRACT` | detailed pilot audit; keep |
| `citizen-mobility-traffic-performance.@traffic@release.spec.ts` | `EVIDENCE_PERFORMANCE` | detailed pilot audit; keep |
| `citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts` | `CRITICAL_E2E` | detailed pilot audit; split candidate |
| `citizen-mobility-traffic-save-load.@traffic@release.spec.ts` | `CRITICAL_E2E` | detailed pilot audit; split candidate |
| `citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts` | `BROWSER_CONTRACT` | detailed pilot audit; some deterministic assertions are split candidates |
| `city-ui-dialogs.@rci@interaction.spec.ts` | `BROWSER_CONTRACT` | keep browser authority |
| `city-ui-inspect-information.@interaction@building@road@zoning.spec.ts` | `BROWSER_CONTRACT` | detailed Road pilot audit; keep UI authority |
| `city-ui-m6-4-mobile-declutter.@interaction@rci@release.spec.ts` | `BROWSER_CONTRACT` | keep browser authority |
| `city-ui-responsive.@interaction@smoke@release.spec.ts` | `BROWSER_CONTRACT` | keep browser authority |
| `economy.@rci@interaction@smoke.spec.ts` | `APPLICATION_INTEGRATION` | future detailed split audit; keep for now |
| `game.@interaction@smoke.spec.ts` | `CRITICAL_E2E` | keep bounded smoke authority |
| `growth-reservation.@building.spec.ts` | `APPLICATION_INTEGRATION` | future deterministic migration candidate; keep for now |
| `growth-visual-evidence.@building@visual@release.spec.ts` | `EVIDENCE_PERFORMANCE` | keep browser evidence |
| `growth.@building.spec.ts` | `APPLICATION_INTEGRATION` | future detailed split audit; keep for now |
| `interaction-conformance.@interaction@smoke.spec.ts` | `THREEJS_INTEGRATION` | keep browser authority |
| `interaction.@interaction.spec.ts` | `THREEJS_INTEGRATION` | keep browser authority |
| `rci.@rci@smoke.spec.ts` | `APPLICATION_INTEGRATION` | future detailed split audit; keep for now |
| `road-operation-aware-interaction.@road@interaction.spec.ts` | `THREEJS_INTEGRATION` | detailed pilot audit; keep |
| `road-reversible-stroke.@road@interaction.spec.ts` | `THREEJS_INTEGRATION` | detailed pilot audit; keep |
| `road-visibility.@road@visual.spec.ts` | `EVIDENCE_PERFORMANCE` | detailed pilot audit; keep |
| `road-visual-evidence.@road@visual@release.spec.ts` | `EVIDENCE_PERFORMANCE` | detailed pilot audit; keep; one journey is a split candidate |
| `road.@road.spec.ts` | `THREEJS_INTEGRATION` | detailed pilot audit; fixture matrix is a major split candidate |
| `terraform-visual-evidence.@terrain@visual@performance@release.spec.ts` | `EVIDENCE_PERFORMANCE` | keep browser evidence |
| `terraform.@terrain.spec.ts` | `THREEJS_INTEGRATION` | keep browser authority; later inspect deterministic planner assertions |
| `terrain-lab.@terrain@water.spec.ts` | `THREEJS_INTEGRATION` | keep Terrain Lab browser authority |
| `transaction-release.@road@interaction.spec.ts` | `THREEJS_INTEGRATION` | detailed pilot audit; keep |
| `visual-evidence.@terrain@water@visual@performance@release.spec.ts` | `EVIDENCE_PERFORMANCE` | keep browser evidence |
| `water.@water.spec.ts` | `THREEJS_INTEGRATION` | keep browser authority; later inspect deterministic water assertions |
| `zoning-visual-evidence.@zoning@visual@release.spec.ts` | `EVIDENCE_PERFORMANCE` | keep browser evidence |
| `zoning.@zoning.spec.ts` | `THREEJS_INTEGRATION` | keep browser authority; later inspect deterministic zoning assertions |

## Findings

### F1 — Browser cost is concentrated by mixed authority, not simply by test count

Several specs combine deterministic state assertions with real pointer/render/UI evidence. Treating the whole file as either “browser” or “unit” would lose authority. Future migrations must split facts, not files mechanically.

### F2 — Road fixture enumeration is the clearest downward-migration candidate

`road.@road.spec.ts` currently runs a large deterministic Terrain Lab fixture matrix. The matrix proves important topology/validity facts but also checks presentation roots and geometry evidence. Future work should move the exhaustive topology/validity matrix to deterministic Road/Three adapter tests while retaining a much smaller representative browser rendering matrix.

### F3 — Road interaction tests are genuine browser/Three.js authority

Pointer capture, touch-to-camera ownership transfer, reversible stroke visuals, screen-relative camera pan after rotation, visible-pixel changes, release outside the canvas/map, and WebGL context restoration cannot be replaced by pure domain tests.

### F4 — Traffic has three distinct authorities that should stop sharing one broad browser bucket

Traffic tests naturally separate into:

- deterministic lifecycle/routing/reservation/persistence facts;
- browser UI/layout/locale/information-view contracts;
- visual/performance presentation evidence.

This is the strongest pilot for moving deterministic proof downward while preserving presentation confidence.

### F5 — Performance evidence must remain browser-owned

The 5,000-trip Traffic test samples `requestAnimationFrame`, presentation spatial culling, visible caps, pool reuse and browser memory/timing evidence. These are browser/runtime facts and are not migration targets.

## Migration safety contract for PR-T3.2 and later

A future migration may narrow or remove a Playwright assertion only when all of the following are true:

1. The deterministic fact has a new lower-layer RED test.
2. The production/current behavior makes that test GREEN without weakening semantics.
3. The replacement executes in the intended owner package/application layer.
4. Remaining DOM/Three.js/visual/performance authority is still covered in Playwright.
5. Exact-head verification is GREEN after the change.
6. Browser test removal is traceable to the replacement proof in the same PR.

No numerical browser-test reduction target is authorized. Coverage and authority are the constraints; runtime reduction is a consequence, not the goal.

## Risk

The main risk is false confidence from labeling a mixed test as “logic” and removing the browser half of its authority. Therefore `DOMAIN_LOGIC_CANDIDATE` and `APPLICATION_INTEGRATION` mean **candidate for replacement proof**, not permission to delete Playwright coverage.

## Non-goals

PR-T3.1 does **not**:

- migrate tests to Vitest;
- delete, skip, reduce, rewrite, or retag Playwright tests;
- change browser workers, retries, timeout, project configuration, CI or verification policy;
- change production/game/runtime behavior;
- change exact-head Three.js release authority;
- fix unrelated flaky tests.

## Decision

PR-T3.1 approves only the **classification model and audit record**. The first implementation pilot, if separately approved, should be Road / Traffic and should prioritize exhaustive deterministic matrices and state-only assertions while preserving every real browser/Three.js/UI/evidence contract.