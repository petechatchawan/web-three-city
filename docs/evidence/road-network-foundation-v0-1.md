# Road Network Foundation v0.1 — Verification Ledger

**Repository:** `petechatchawan/web-three-city`  
**Pull request:** `#11`  
**Branch:** `agent/road-network-foundation-v0-1`  
**Verification policy:** Manual/local; automatic GitHub Actions disabled by owner decision  
**Deployment policy:** Manual Vercel; Git-triggered deployment disabled  
**Merge status:** Conditionally authorized by owner; not executed while final dependency and exact-head WebGL gates remain open  
**Owner visual acceptance:** Source-exact responsive UI/control matrix passed; exact-head WebGL application rendering remains pending

## Implemented contract inventory

- Terrain exposes immutable cell-surface profiles; Terrain and Water do not import Road modules.
- `road-core` owns immutable Road snapshots, topology derivation, placement policy, mutation plans, stale-plan fencing, receipts, persistence, and legacy empty-Road migration.
- `road-three` owns deterministic procedural Road geometry, Three.js adaptation, committed chunk presentation, valid/invalid Preview presentation, atomic replacement, and disposal.
- Game composition owns Road input routing, Road/Toolbar UI state, Terrain-over-Road rejection, tagged one-level world Undo, world Save/Load, context restoration, and cross-system diagnostics.
- Terrain Lab contains the locked 24-fixture Road registry covering topology, Ramp alignment, invalid placement, wet rejection, and chunk-boundary continuity.
- Browser acceptance specifications cover desktop tap/drag, touch cancellation, Build/Bulldoze, Water non-rebuild, Terraform rejection, Undo, persistence, context restoration, fixture diagnostics, and screenshot generation.

## Manual verification completed

Verification was performed on 2026-07-30 after the owner disabled automatic GitHub Actions.

- Core and `road-three` TypeScript validation: **PASS**
- Game integration TypeScript validation: **PASS**
- Targeted core and geometry checks: **11/11 PASS**
- Targeted Game integration checks: **7/7 PASS**
- Original targeted checks: **18/18 PASS**
- Fresh production Road mesh-data verification after final review: **5/5 PASS**
- Source-exact desktop/mobile UI and control verification: **30/30 PASS**
- Desktop viewport: **1440 × 900**, expanded controls, panel fully within viewport
- Mobile viewport: **390 × 844**, compact controls, panel fully within viewport

The targeted checks cover:

- immutable snapshots and defensive copies
- Flat and aligned single-axis Ramp placement policy
- wet, incoherent-world, duplicate, no-change, and stale-plan rejection
- connectivity derivation and mutation receipts
- Road serialization round-trip and malformed data rejection
- deterministic flat and sloped geometry
- shared Road edge continuity and merged mesh index offsets
- geometry adaptation, committed chunk rebuilding, disposal, and invalid Preview cleanup
- Road placement environment revision fencing
- continuous Road Preview, pointer cancellation, and stale-pointer fencing
- immediate invalid Terraform Preview when affected cells overlap Road cells
- one-level tagged world Undo with monotonic world revision
- desktop/mobile responsive control layout
- Road/Terraform tool activation and mode-aware brush visibility
- world-level Save, Load, and Undo accessible names
- quality control and Grid toggle state

## Final-review correction

The final review found that `apps/game/src/main.ts` replaced the world-level action labels rendered by `game-ui.ts` with obsolete Terraform-only labels. This would make current browser locators for `Save world`, `Load world`, and `Undo latest world change` fail. Commit `3c9940444bb71ac2db598be188f250e4da98f3a0` removed those overrides and preserves the canonical world-level labels.

## Dependency gate

The package manifests require these workspace links that are not yet represented in the committed lockfile importers:

- `apps/game` → `@web-three-city/road-three`
- `apps/terrain-lab` → `@web-three-city/road-core`
- `apps/terrain-lab` → `@web-three-city/road-three`

The existing `packages:` and `snapshots:` resolution blocks are valid and must remain unchanged. A real `pnpm install` with repository pnpm `10.13.1` is still required to generate and validate the three importer entries. The verification sandbox could not download the official pnpm executable because outbound DNS and release-asset downloads are blocked. This gate is therefore **PENDING**, not passed by manual file editing.

## Automation and deployment policy

- `.github/workflows/ci.yml` was removed; no GitHub Actions workflow runs automatically.
- Vercel Git deployment remains disabled through `vercel.json`.
- Deployment is performed manually only.
- `.npmrc` sets `frozen-lockfile=false` so a manual install can refresh workspace importer links before a manual build or deployment.
- The original package-resolution block in `pnpm-lock.yaml` remains preserved.

## Verification boundaries

The responsive UI/control screenshots and Road mesh-data tests verify the reviewed production UI structure, control state transitions, and Road geometry data. They do not replace an exact-head build of the complete Three.js application. The following remain open until dependencies can be installed:

- real `pnpm install` and generated lockfile importer validation
- exact-head complete application build
- exact-head WebGL Road rendering and interaction run on desktop/mobile emulation

Automatic protected Vercel Preview remains outside the completion gate under the owner-selected manual deployment policy.

## Manual screenshot inventory produced during final review

- `road-ui-desktop.png`
- `road-ui-mobile.png`

No repository screenshot hash is claimed because these review artifacts were produced outside the repository workspace and were not committed.

## Final acceptance checklist

- [x] Written specification approved
- [x] TDD implementation plan approved
- [x] Tasks 1–10 source implementation present on the PR branch
- [x] Unit and browser acceptance specifications present
- [x] Deterministic Road geometry hash contracts present
- [x] Core and `road-three` TypeScript validation passed
- [x] Game integration TypeScript validation passed
- [x] Targeted manual checks passed, 18/18
- [x] Fresh Road mesh-data checks passed, 5/5
- [x] Source-exact desktop/mobile UI and control checks passed, 30/30
- [x] Obsolete world-action aria-label overrides removed
- [x] Automatic GitHub Actions removed
- [x] Automatic Vercel Git deployment disabled
- [x] Conditional owner merge authorization received
- [ ] Real `pnpm install` lockfile refresh
- [ ] Exact-head complete application build
- [ ] Exact-head WebGL desktop/mobile Road visual and interaction acceptance
- [ ] Merge execution
