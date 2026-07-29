# Road Network Foundation v0.1 — Verification Ledger

**Repository:** `petechatchawan/web-three-city`  
**Pull request:** `#11`  
**Branch:** `agent/road-network-foundation-v0-1`  
**Merge status:** Not authorized  
**Owner visual acceptance:** Pending

## Implemented contract inventory

- Terrain exposes immutable cell-surface profiles; Terrain and Water do not import Road modules.
- `road-core` owns immutable Road snapshots, topology derivation, placement policy, mutation plans, stale-plan fencing, receipts, persistence, and legacy empty-Road migration.
- `road-three` owns deterministic procedural Road geometry, Three.js adaptation, committed chunk presentation, valid/invalid Preview presentation, atomic replacement, and disposal.
- Game composition owns Road input routing, Road/Toolbar UI state, Terrain-over-Road rejection, tagged one-level world Undo, world Save/Load, context restoration, and cross-system diagnostics.
- Terrain Lab contains the locked 24-fixture Road registry covering topology, Ramp alignment, invalid placement, wet rejection, and chunk-boundary continuity.
- Browser acceptance specifications cover desktop tap/drag, touch cancellation, Build/Bulldoze, Water non-rebuild, Terraform rejection, Undo, persistence, context restoration, fixture diagnostics, and screenshot generation.

## Verified checkpoints completed before GitHub Actions quota exhaustion

The latest complete exact-head GitHub Actions checkpoint was run `30466945433` on head `a6d8c1b3de1f89964d8d2fae992fd7ef437b25d1`.

- Quality and provenance: PASS
- Unit, geometry, and golden tests: PASS
- Build all packages and applications: PASS
- Chromium smoke, interaction, and visual evidence: PASS

That checkpoint covers Tasks 1–4. Later Road geometry RED/GREEN evidence established deterministic geometry, shared-edge continuity, and locked hashes before the account quota stopped new runners. Task 6–10 source and acceptance specifications were subsequently implemented but have not yet received a runnable exact-head Actions result.

## Current external verification blocker

GitHub notified the repository owner that the account had consumed 100% of included Actions minutes. New jobs are rejected before runner setup, with no executable steps or job logs. This is an account execution gate, not a passing or failing result for the current head.

The following evidence must therefore remain pending until Actions execution is restored:

- `pnpm install --frozen-lockfile`
- format, lint, typecheck, provenance, unit/coverage, deployment, and build gates on the final exact head
- Chromium browser acceptance on the final exact head
- generated `browser-evidence` artifact and screenshot SHA-256 inventory
- protected Vercel Preview sourced from the exact successful CI artifact
- owner desktop/mobile visual acceptance

## Planned screenshot artifact inventory

The browser specification `browser-tests/road-visual-evidence.spec.ts` generates these files when the browser gate runs:

- `road-topology-four-way.png`
- `road-ramp-north-south.png`
- `road-ramp-east-west.png`
- `road-invalid-ramp-preview.png`
- `road-invalid-wet-preview.png`
- `road-chunk-boundary.png`
- `road-game-desktop.png`
- `road-game-mobile.png`

No screenshot hash is recorded here until the files are actually produced. Projected values are prohibited.

## Final acceptance checklist

- [x] Written specification approved
- [x] TDD implementation plan approved
- [x] Tasks 1–10 source implementation present on the PR branch
- [x] Unit/browser acceptance specifications present
- [x] Deterministic Road geometry hash contracts present
- [x] Temporary formatter/diagnostic workflows removed
- [ ] Final exact-head frozen-lockfile install
- [ ] Final exact-head repository gates
- [ ] Final browser evidence artifact and measured screenshot hashes
- [ ] Protected exact-head Preview
- [ ] Owner visual acceptance
- [ ] Explicit merge authorization for the final exact head
