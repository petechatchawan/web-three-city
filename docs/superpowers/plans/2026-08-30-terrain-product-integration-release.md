# Terrain Product Integration Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the complete Terrain Product Integration v1 flow on desktop/mobile and prepare a stacked PR without merging P1-F prematurely.

**Architecture:** Verification only; fix genuine defects with fresh RED/GREEN commits. Preserve PR #113 manual-acceptance boundary.

**Tech Stack:** pnpm verify, Vitest, Playwright Chromium desktop/mobile emulation, GitHub CI/Sonar.

**Spec:** `docs/superpowers/specs/2026-08-30-terrain-product-integration-v1-design.md`

---

### Task 1: Integrated browser journeys

- [ ] New City arbitrary seed -> generated fingerprint -> eligible Region -> create -> 64 sectors.
- [ ] Seed repeatability: same seed in fresh test DB yields same fingerprint/representative semantics.
- [ ] Debug layers toggle and survive Terrain projection lifecycle.
- [ ] Desktop camera + semantic pick.
- [ ] Mobile camera gestures + semantic tap arbitration.
- [ ] Explicit Save -> Home -> Load -> same seed/revision/World starting Region.
- [ ] Two saves -> Resume highest lastPlayedAt with deterministic tie rule.
- [ ] IndexedDB corrupt/unsupported save surfaces error without fallback regeneration.

### Task 2: Maintainability/authority audit

- [ ] No `acceptedTerrainSeeds`, `localStorage`, production OrbitControls, or unload autosave.
- [ ] No `three`/DOM under Terrain domain/application.
- [ ] Orchestration imports no system `./composition` and no app package.
- [ ] App composition adapters contain no starting-region/seed fallback policy.
- [ ] No P1-F/P1-G canonical constants duplicated in event/UI handlers.
- [ ] Save JSON/structured data contains no Mesh/material/camera/debug keys.
- [ ] Production module file sizes/responsibilities reviewed; split any God Object before release.

### Task 3: Exact-head release gate

- [ ] Node 22.18.0 / pnpm 10.15.1.
- [ ] `pnpm format:check`.
- [ ] `pnpm lint`.
- [ ] `pnpm typecheck`.
- [ ] `pnpm test`.
- [ ] `pnpm architecture:check` -> 0 violations.
- [ ] `pnpm build`.
- [ ] `pnpm test:browser`.
- [ ] `pnpm verify` exact HEAD.
- [ ] clean worktree.

### Task 4: Documentation verification update

- [ ] Update Terrain/World/App/City Session READMEs with implemented public surfaces and verification status.
- [ ] Add concise verification docs under owner `verification/` directories with exact SHA/test counts/browser flows.
- [ ] Ensure no unresolved placeholder markers and no active docs contradict arbitrary Seed64 / restore / lifecycle semantics.

### Task 5: Stacked PR evidence

- [ ] Push `feat/terrain-product-integration-v1`.
- [ ] Open PR targeting `feat/phase-1f-threejs-presentation` while PR #113 awaits manual visual acceptance.
- [ ] Require CI verify and Sonar Quality Gate SUCCESS on exact head.
- [ ] Do not merge this stacked PR before its base is integrated/rebased and the user authorizes final integration.
