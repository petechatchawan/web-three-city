# Road Network Foundation v0.1 — Verification Ledger

**Repository:** `petechatchawan/web-three-city`  
**Pull request:** `#11`  
**Branch:** `agent/road-network-foundation-v0-1`  
**Implementation checkpoint HEAD:** `23cbeda685c016ad9d12832ed4b53a6abdcd028e`  
**Evidence-ledger update commit:** `de0c62daf0f7da4d69a3da7b9269468cea248914`  
**Verification policy:** Manual/local; automatic GitHub Actions disabled by owner decision  
**Deployment policy:** Manual Vercel; Git-triggered deployment disabled  
**Merge status:** Open and unmerged; final merge remains blocked by the exact-head repository and WebGL gates

## 1. Evidence interpretation

This ledger contains two distinct evidence generations:

1. **Historical Road Network Foundation baseline evidence** produced before the Web Interaction & Tooling Conformance v0.1 amendment.
2. **Current conformance implementation evidence** for the amendment approved on 2026-07-30.

Historical results remain useful regression evidence, but they do **not** prove the current PR head passes repository typecheck, tests, build, or WebGL acceptance after the interaction, Terraform planning, preview, HUD, and browser-test changes.

## 2. Historical Road baseline evidence

The earlier Road foundation review recorded:

- original targeted checks: **18/18 PASS**;
- fresh Road mesh-data checks: **5/5 PASS**;
- source-exact responsive UI/control checks: **30/30 PASS**;
- desktop review viewport: **1440 × 900**;
- responsive review viewport: **390 × 844**;
- correction of obsolete world-action labels in commit `3c9940444bb71ac2db598be188f250e4da98f3a0`.

Those checks covered the pre-amendment Road snapshot, connectivity, placement, geometry, save/load, Undo, input, UI, and presentation baseline. The screenshots `road-ui-desktop.png` and `road-ui-mobile.png` are historical artifacts and no longer represent the current desktop-first HUD implementation.

## 3. Current conformance implementation inventory

The current branch contains source and regression-test changes for Tasks 1–10 of:

`docs/superpowers/plans/2026-07-30-web-interaction-tooling-conformance-v0-1.md`

Implemented source areas include:

- one-step Raise, Lower, and Flatten planning from an immutable pointer-down Terrain baseline;
- bounded automatic support propagation with explicit core/support plan data;
- projected Water and shoreline comparison without authoritative Water mutation;
- exhaustive product reason catalog and exact blocked-Road cell reporting;
- per-stamp Terraform acceptance, rejection, no-change, cancellation, and release routing;
- prevention of invalid or Road-blocked releases entering authoritative Terrain mutation;
- semantic Terraform preview layers for accepted core, support, rejected stamp, no-change, and projected Water;
- non-color rejected Terraform and invalid Road markers;
- desktop-first/map-first HUD hierarchy and live contextual counts/reasons;
- Close Tool, keyboard shortcuts, visibility cancellation, page-exit disposal, and recovery fencing;
- transaction-state presentation for valid final Terraform/Road commits and tagged Undo operations;
- immediately accessible secondary Save/Load/camera controls with viewport refresh after expansion;
- final-release ownership in `game-input.ts`, avoiding false commit-state announcements when pointer capture releases a Road stroke outside the map;
- exact-head Playwright conformance scenarios, including outside-map Road-release cancellation;
- disposal of the Road invalid-marker material in both Road presentation owners.

## 4. Verification performed for the amendment

The constrained execution environment has no local repository checkout and cannot install repository dependencies. Within that limitation, the following checks were performed:

### Tasks 1–8 partial evidence

- exact-source TypeScript harnesses for Tasks 1–4: **PASS**;
- focused runtime assertions for one-step Terraform planning and support propagation: **PASS**;
- focused projected-Water transition and immutability assertions: **PASS**;
- guarded Terraform blocked-cell and exhaustive-reason assertions: **PASS**;
- per-stamp session assertions for accepted → rejected → accepted, immutable baseline, no-change, release, and cancellation: **PASS**;
- source audit found and fixed missing disposal of the Road invalid-marker material.

### Task 9 evidence at the current implementation checkpoint

- strict TypeScript compile of the exact Task 9 event/HUD/main/secondary-control/transaction modules using global TypeScript `5.8.3`: **PASS**;
- final Terraform release, final Road plan, and tagged Undo transaction-selector assertions: **10/10 PASS**;
- source-exact Task 9 Chromium HUD harness at desktop `1440 × 900`: **11/11 PASS**;
- source-exact Task 9 Chromium HUD harness at responsive `390 × 844`: **12/12 PASS**;
- verified transaction-state contextual copy, mutation-control fencing, completion re-enable, Undo state, secondary-control expansion, Save visibility, no horizontal overflow, and responsive panel height;
- audited `packages/camera-input/src/dom-input-binding.ts` pointer-capture ownership and moved commit-state production from global `pointerup` into final plan/release routing.

### Task 10 state

- Playwright conformance specifications are present;
- outside-map Road pointer-capture regression is present in `browser-tests/transaction-release.spec.ts`;
- the complete built Game/Terrain Lab WebGL suite has **not** been executed in this environment.

The Task 9 harnesses are partial evidence only. They do not replace repository TypeScript `6.0.3`, Vitest, Vite build, or the complete Playwright/WebGL application run.

GitHub combined status for implementation checkpoint HEAD `23cbeda685c016ad9d12832ed4b53a6abdcd028e` reports no checks because automatic CI is disabled.

## 5. Dependency and workspace blocker

The repository requires:

```text
Node >=22.0.0
pnpm 10.13.1
```

The execution environment has Node `v22.16.0`, but:

- no `pnpm` executable is installed;
- no local `web-three-city` checkout is mounted;
- Corepack cannot download `pnpm@10.13.1` because outbound registry access is blocked;
- no usable offline pnpm cache is available.

Therefore `pnpm install` was not run and no generated lockfile claim is made.

The committed lockfile blob is still `b592bc8b3d22d6aa59c7c495de48d09c16ac63ac` and requires a real pnpm-generated importer refresh for:

- `apps/game` → `@web-three-city/road-three`;
- `apps/terrain-lab` → `@web-three-city/road-core`;
- `apps/terrain-lab` → `@web-three-city/road-three`.

Manual reconstruction of integrity-bearing package or snapshot blocks is prohibited.

## 6. Exact-head gates still required

Run from a clean local checkout of `agent/road-network-foundation-v0-1`:

```bash
git switch agent/road-network-foundation-v0-1
git pull
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install
git diff -- pnpm-lock.yaml

pnpm exec vitest run \
  packages/terrain-core/test/terraform-support-propagation.test.ts \
  apps/game/src/terraform-water-projection.test.ts \
  apps/game/src/terraform-road-guard.test.ts \
  apps/game/src/game-reason-catalog.test.ts \
  apps/game/src/terraform-stroke-session.test.ts \
  apps/game/src/game-input-terraform-routing.test.ts \
  apps/game/src/terraform-preview-adapter.test.ts \
  apps/game/src/game-tool-presentation.test.ts \
  apps/game/src/game-ui.test.ts \
  apps/game/src/game-keyboard-shortcuts.test.ts \
  apps/game/src/game-tool-events.test.ts \
  apps/game/src/game-tool-hud-binding.test.ts \
  apps/game/src/game-secondary-controls.test.ts \
  apps/game/src/game-transaction-presentation.test.ts \
  packages/terrain-three/test/terraform-preview-model.test.ts \
  packages/terrain-three/test/terraform-preview-geometry.test.ts \
  packages/terrain-three/test/terraform-preview-presentation.test.ts \
  packages/road-three/test/road-invalid-marker.test.ts \
  packages/road-three/test/road-preview-presentation.test.ts

pnpm check
pnpm --filter @web-three-city/game build
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright install chromium
pnpm test:browser
git diff --check
git status --short
```

Verification must record:

- exact pushed HEAD SHA;
- generated `pnpm-lock.yaml` importer diff and confirmation of no unrelated integrity churn;
- focused and repository-wide test counts;
- TypeScript and build exit codes;
- Playwright test count and failures, if any;
- desktop `1440 × 900` screenshots and interaction observations;
- responsive `390 × 844` screenshots and compatibility observations;
- preview root/layer cleanup evidence;
- any remaining limitation.

## 7. Current acceptance checklist

- [x] Web Interaction & Tooling Conformance v0.1 specification approved
- [x] TDD implementation plan approved
- [x] Inline Execution selected
- [x] Tasks 1–10 source changes and regression specifications present
- [x] Invalid Terraform commit route removed from normal release routing
- [x] Semantic Terraform preview contracts and object names present
- [x] Non-color Road invalid marker present
- [x] Desktop-first HUD and responsive compatibility rules present
- [x] Task 9 transaction, lifecycle, keyboard, recovery, and accessible-secondary-control implementation present
- [x] Task 9 strict constrained compile and focused selector/HUD harnesses passed
- [x] Historical Road baseline evidence retained and labelled as historical
- [ ] Real `pnpm install` and generated lockfile refresh
- [ ] Current exact-head TypeScript 6.0.3 typecheck
- [ ] Current exact-head focused and repository-wide Vitest execution
- [ ] Current exact-head Game and Terrain Lab builds
- [ ] Current exact-head Playwright/WebGL suite
- [ ] Current desktop visual acceptance
- [ ] Current responsive compatibility smoke against the built application
- [ ] Exact-head repository evidence counts and screenshots recorded
- [ ] Final owner merge authorization
- [ ] Merge execution
