# Road Network Foundation v0.1 — Verification Ledger

**Repository:** `petechatchawan/web-three-city`  
**Pull request:** `#11`  
**Branch:** `agent/road-network-foundation-v0-1`  
**Verification policy:** Manual/local; automatic GitHub Actions disabled by owner decision  
**Deployment policy:** Manual Vercel; Git-triggered deployment disabled  
**Merge status:** Not authorized  
**Owner visual acceptance:** Pending

## Implemented contract inventory

- Terrain exposes immutable cell-surface profiles; Terrain and Water do not import Road modules.
- `road-core` owns immutable Road snapshots, topology derivation, placement policy, mutation plans, stale-plan fencing, receipts, persistence, and legacy empty-Road migration.
- `road-three` owns deterministic procedural Road geometry, Three.js adaptation, committed chunk presentation, valid/invalid Preview presentation, atomic replacement, and disposal.
- Game composition owns Road input routing, Road/Toolbar UI state, Terrain-over-Road rejection, tagged one-level world Undo, world Save/Load, context restoration, and cross-system diagnostics.
- Terrain Lab contains the locked 24-fixture Road registry covering topology, Ramp alignment, invalid placement, wet rejection, and chunk-boundary continuity.
- Browser acceptance specifications cover desktop tap/drag, touch cancellation, Build/Bulldoze, Water non-rebuild, Terraform rejection, Undo, persistence, context restoration, fixture diagnostics, and screenshot generation.

## Manual verification completed

Verification was completed on 2026-07-30 after the owner disabled automatic GitHub Actions. Follow-up commits after the source checks only changed repository policy and verification documentation; they did not change Road runtime implementation.

- Core and `road-three` TypeScript validation: **PASS**
- Game integration TypeScript validation: **PASS**
- Targeted core and geometry checks: **11/11 PASS**
- Targeted Game integration checks: **7/7 PASS**
- Total targeted checks: **18/18 PASS**

The targeted checks cover:

- immutable snapshots and defensive copies
- Flat and aligned single-axis Ramp placement policy
- wet, incoherent-world, duplicate, no-change, and stale-plan rejection
- connectivity derivation and mutation receipts
- Road serialization round-trip and malformed data rejection
- deterministic flat and sloped geometry
- geometry adaptation, committed chunk rebuilding, disposal, and invalid Preview cleanup
- Road placement environment revision fencing
- continuous Road Preview, pointer cancellation, and stale-pointer fencing
- immediate invalid Terraform Preview when affected cells overlap Road cells
- one-level tagged world Undo with monotonic world revision

## Automation and deployment policy

- `.github/workflows/ci.yml` was removed; no GitHub Actions workflow runs automatically.
- Vercel Git deployment remains disabled through `vercel.json`.
- Deployment is performed manually only.
- `.npmrc` sets `frozen-lockfile=false` so a manual install can refresh workspace importer links before a manual build or deployment.
- The original package-resolution block in `pnpm-lock.yaml` was restored exactly after an unsafe whole-file edit was rejected during cleanup.
- The committed lockfile still requires a manual `pnpm install` refresh to add the current Road workspace importer links. This is an explicit temporary deviation under the manual-only policy, not a frozen-lockfile verification result.

## Verification boundaries

The following evidence was intentionally removed from the automatic completion gate when the owner disabled Actions and automatic Vercel deployment:

- exact-head cloud CI status
- exact-head Playwright artifact and screenshot SHA-256 inventory
- automatic protected Vercel Preview

Browser specifications remain in the repository, but no screenshot hash is claimed until a manual browser run actually produces those files.

## Planned manual screenshot inventory

- `road-topology-four-way.png`
- `road-ramp-north-south.png`
- `road-ramp-east-west.png`
- `road-invalid-ramp-preview.png`
- `road-invalid-wet-preview.png`
- `road-chunk-boundary.png`
- `road-game-desktop.png`
- `road-game-mobile.png`

## Final acceptance checklist

- [x] Written specification approved
- [x] TDD implementation plan approved
- [x] Tasks 1–10 source implementation present on the PR branch
- [x] Unit and browser acceptance specifications present
- [x] Deterministic Road geometry hash contracts present
- [x] Core and `road-three` TypeScript validation passed
- [x] Game integration TypeScript validation passed
- [x] Targeted manual checks passed, 18/18
- [x] Automatic GitHub Actions removed
- [x] Automatic Vercel Git deployment disabled
- [x] Manual dependency-refresh policy recorded
- [ ] Manual `pnpm install` lockfile refresh on the developer machine
- [ ] Manual Vercel Preview or production deployment
- [ ] Owner desktop/mobile visual acceptance
- [ ] Explicit merge authorization
