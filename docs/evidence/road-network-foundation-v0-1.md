# Road Network Foundation v0.1 — Verification Ledger

**Repository:** `petechatchawan/web-three-city`  
**Pull request:** `#11`  
**Branch:** `agent/road-network-foundation-v0-1`  
**Verification policy:** Manual/local; automatic GitHub Actions disabled by owner decision  
**Deployment policy:** Manual Vercel; Git-triggered deployment disabled  
**Merge status:** Open; not authorized for final merge until Web Interaction & Tooling Conformance v0.1 and all exact-head gates pass

## 1. Evidence interpretation

This ledger contains two distinct evidence generations:

1. **Historical Road Network Foundation baseline evidence** produced before the Web Interaction & Tooling Conformance v0.1 amendment.
2. **Current conformance implementation evidence** for the amendment approved on 2026-07-30.

Historical results remain useful regression evidence, but they do **not** prove the current PR head passes typecheck, tests, build, or WebGL acceptance after the interaction, Terraform planning, preview, HUD, and browser-test changes.

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

The current branch now contains source and regression-test changes for Tasks 1–10 of:

`docs/superpowers/plans/2026-07-30-web-interaction-tooling-conformance-v0-1.md`

Implemented source areas include:

- one-step Raise, Lower, and Flatten planning from an immutable pointer-down Terrain baseline;
- bounded automatic support propagation with explicit core/support plan data;
- projected Water and shoreline comparison without authoritative Water mutation;
- exhaustive product reason catalog;
- exact blocked-Road cell reporting;
- per-stamp Terraform acceptance, rejection, no-change, cancellation, and release routing;
- prevention of invalid or Road-blocked releases entering authoritative Terrain mutation;
- semantic Terraform preview layers for accepted core, support, rejected stamp, no-change, and projected Water;
- non-color rejected Terraform markers;
- non-color invalid Road markers that follow Terrain ramps;
- desktop-first/map-first HUD hierarchy;
- live contextual Terraform and Road counts/reasons;
- Close Tool, keyboard shortcuts, visibility cancellation, and page-exit disposal;
- exact-head Playwright conformance scenarios;
- disposal of the Road invalid-marker material in both Road presentation owners.

## 4. Verification performed for the amendment

The constrained execution environment has no local repository checkout and cannot install repository dependencies. Within that limitation, the following checks were performed:

- exact-source TypeScript harnesses for Tasks 1–4: **PASS**;
- focused runtime assertions for one-step Terraform planning and support propagation: **PASS**;
- focused projected-Water transition and immutability assertions: **PASS**;
- guarded Terraform blocked-cell and exhaustive-reason assertions: **PASS**;
- per-stamp session assertions for accepted → rejected → accepted, immutable baseline, no-change, release, and cancellation: **PASS**;
- source audit found and fixed a missing disposal call for the newly added Road invalid-marker material;
- GitHub combined status for the implementation head reported no checks because automatic CI is disabled.

These checks are partial evidence only. They do not replace repository Vitest, TypeScript 6.0.3, Vite, or Playwright execution.

## 5. Dependency and workspace blocker

The repository requires:

```text
Node >=22.0.0
pnpm 10.13.1
```

The execution environment currently has Node `v22.16.0` and Corepack `0.32.0`, but:

- no `pnpm` executable is installed;
- no local `web-three-city` checkout is mounted;
- `corepack prepare pnpm@10.13.1 --activate` fails while requesting `https://registry.npmjs.org/pnpm/-/pnpm-10.13.1.tgz`;
- no usable offline pnpm cache is available.

Therefore `pnpm install` was not run and no generated lockfile claim is made.

The lockfile still requires a real pnpm-generated importer refresh for:

- `apps/game` → `@web-three-city/road-three`;
- `apps/terrain-lab` → `@web-three-city/road-core`;
- `apps/terrain-lab` → `@web-three-city/road-three`.

Manual reconstruction of integrity-bearing package or snapshot blocks is prohibited.

## 6. Exact-head gates still required

Run from a clean local checkout of `agent/road-network-foundation-v0-1`:

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install
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
- generated `pnpm-lock.yaml` importer diff;
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
- [x] Historical Road baseline evidence retained and labelled as historical
- [ ] Real `pnpm install` and generated lockfile refresh
- [ ] Current exact-head TypeScript 6.0.3 typecheck
- [ ] Current exact-head focused and repository-wide Vitest execution
- [ ] Current exact-head Game and Terrain Lab builds
- [ ] Current exact-head Playwright/WebGL suite
- [ ] Current desktop visual acceptance
- [ ] Current responsive compatibility smoke
- [ ] Exact-head evidence counts and screenshots recorded
- [ ] Final owner merge authorization
- [ ] Merge execution
