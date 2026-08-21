# Test Architecture vNext — PR-T1 Baseline Evidence

**Status:** Audit evidence recorded — no verification topology change applied  
**Date:** 2026-08-21  
**Audited candidate:** `feat/motion-junction-realism-v1@eec1eb2fa28cd7f3558a6fe83efe2fc7dab376bb`  
**Exact CI run:** `32455193092`

## Purpose

Record the factual baseline used by the PR-T1 formal audit. This file is evidence only; it does not redefine the normative workflow in `AGENTS.md`.

## Inventory

Exact candidate topology contracts and CI output establish:

```text
Vitest files across workspaces:       255
Vitest tests across workspaces:     1,032
Game Vitest files:                    93
Game Vitest tests:                   375
node:test deployment/tooling tests:   60
Playwright spec files:                33
Chromium browser tests:              148
```

Primary source paths:

- `tooling/test-topology.test.mjs`
- package/game Vitest output in CI run `32455193092`
- `browser-tests/`

## Browser execution policy

`playwright.config.ts` records:

```text
project:                 chromium
fullyParallel:           false
CI workers:              1
local workers:           2
retries:                 1
trace:                    retain-on-failure
screenshot:               only-on-failure
WebGL backend in CI:      SwiftShader
```

`.github/workflows/ci.yml` records:

- Lean CI runs first and publishes exact Game/Terrain Lab build artifacts.
- Browser CI consumes those artifacts rather than rebuilding.
- PR targeted mode is selected from approved PR-body ownership tags.
- Full Browser is selected for explicit full-regression triggers such as `full-ci`, workflow dispatch, and nightly schedule.
- Browser verification is followed by clean-worktree verification and evidence upload.

## Exact measured timing

Run `32455193092`:

```text
Lean CI:                            ~3m 08s
Targeted tags:                 @road | @traffic
Selected tests:                    60 / 148
Playwright execution:                 9.9m
Browser job total:                ~10m 22s
Browser result:                  60 / 60 PASS
```

This targeted union selected approximately 40.5% of the entire Chromium inventory.

Notable exact-run browser costs include:

```text
camera pan after quarter-turn rotations                36.9s
Road reversible-stroke preview/reverse                 35.1s
5,000 logical Traffic trips browser performance        34.5s
Bulldoze reverse restoration                           32.7s
Road/Zone inspect-information boundary                 31.2s
```

The 21 valid Road Terrain Lab fixture cases in `road.@road.spec.ts` consumed approximately **97.1 seconds** in aggregate on this run. Each is currently a separate browser test/navigation.

## Lower-layer / browser overlap examples

The audit verified concrete mixed-authority specs:

- `citizen-mobility-traffic-save-load.@traffic@release.spec.ts` checks exact domain/application state, Save schema, browser `localStorage`, and presentation continuity in one browser scenario.
- `citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts` uses a real Bulldoze/raycast path but then validates detailed deterministic route-recovery state.
- `growth.@building.spec.ts` combines deterministic construction-per-tick assertions, Save state, simulation controls, and active-tool/browser-isolation behavior.
- `economy.@rci@interaction@smoke.spec.ts` combines Economy policy/persistence assertions with real dialog interaction.
- `rci.@rci@smoke.spec.ts` combines real HUD/dialog semantics, Save behavior, and a fixed `waitForTimeout(1_500)` for a background-tick isolation assertion.

These are split candidates. PR-T1 does not authorize deletion of any browser assertion.

## Browser-only authority examples

The audit also verified that significant coverage genuinely requires a real browser:

- mobile/responsive layout and shell containment;
- real DOM roles/dialog interaction;
- pointer/touch ownership and pointer release;
- camera-relative movement;
- canvas/world raycast selection;
- Three.js committed/preview materialization;
- WebGL context restoration;
- visible-pixel/visual evidence;
- `requestAnimationFrame` and presentation performance/culling evidence.

This evidence supports retaining exact-head Three.js/browser authority in Testing Architecture vNext.

## Verification-policy drift found by PR-T1

The current `AGENTS.md` Static Level 2 Verification Map does **not** contain owner rows for the already-present:

```text
citizen-mobility-core
traffic-core
traffic-three
```

while the Development Workflow rules state that new packages must have ownership and Level 2 consumers assigned before their implementation PR is ready.

This is a real policy-maintenance gap, not a reason to weaken Level 2 verification. Before changed-source selection can become authoritative, PR-T2/PR-T4 must reconcile the conservative consumer map with the current workspace/package graph and add explicit risk classes for graph-visible and graph-blind dependencies.

Until that reconciliation is complete, the existing static map plus explicit affected-scope expansion remains the conservative safety mechanism.

## Evidence conclusion

The measured problem is not that Full Browser runs on every pull request; current policy already avoids that. The measured problem is that a feature-tagged targeted browser union can still be broad and can mix deterministic, browser-contract, Three.js, E2E, visual, and performance authority in one execution set.

The PR-T1 formal audit therefore recommends authority classification, lower-layer relocation of deterministic proof, browser-case batching where browser authority is unchanged, and fail-safe changed-source selection while preserving exact-head Three.js release evidence.