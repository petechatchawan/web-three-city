# Operation-Aware Road Preview, Release Reliability, and Camera Pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Road Build/Bulldoze Preview unambiguous, preserve the latest Road plan when pointer-up leaves Terrain, and keep camera pan screen-relative at every yaw.

**Architecture:** Extend Road presentation with operation-specific materials and markers while preserving PR #15 cell-scoped geometry. Change Road release to finalize an optional release cell from the controller's captured session state. Replace the manual yaw formula with a camera-derived horizontal screen basis and verify actual projected motion.

**Tech Stack:** TypeScript 6, Three.js 0.185.1, Vitest 4, Playwright 1.61, Vite 8, pnpm 10.13.1.

**Execution Status:** Complete and verified on `master@a6601ca6fc27ef66b62f0d793fb7bc2a4ea39255`.

## Global Constraints

- Work directly on `master` as authorized by the owner.
- Preserve Road core mutation, save/load, undo, stale fencing, and Terraform/Road ownership contracts.
- Do not alter Terraform release semantics.
- Keep Preview geometry restricted to the active mutation footprint.
- `pointercancel`, Escape, blur, second-touch transfer, context loss, and explicit clear remain cancel-only.
- No temporary workflow or trigger file may remain in the final tree.
- Final evidence must come from one exact `master` head.

---

### Task 1: Operation-aware Road Preview materials

**Files:**
- Modify: `packages/road-three/src/material-factory.ts`
- Modify: `packages/road-three/src/road-preview-presentation.ts`
- Modify: `packages/road-three/test/road-preview-presentation.test.ts`

**Interfaces:**
- Produces: `RoadMaterials.buildValidPreview`, `buildInvalidPreview`, `bulldozeValidPreview`, `bulldozeInvalidPreview`, `invalidMarker`, and `bulldozeMarker`.
- Consumes: `RoadMutationPlan.operation` and `RoadMutationPlan.valid`.

- [x] **Step 1: Write failing material-selection tests**

Add tests that construct valid Build, valid Bulldoze, invalid Build, and invalid Bulldoze plans and assert distinct material names on the Preview mesh. Assert that valid Bulldoze also creates a named `road-preview-bulldoze-marker` object.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @web-three-city/road-three test -- road-preview-presentation.test.ts
```

Expected: FAIL because valid Build and Bulldoze both use `road-material-preview-valid`, and no Bulldoze marker exists.

- [x] **Step 3: Implement operation-aware materials**

Create four Preview mesh materials with these names:

```text
road-material-preview-build-valid
road-material-preview-build-invalid
road-material-preview-bulldoze-valid
road-material-preview-bulldoze-invalid
```

Use green for valid Build, red for invalid Build, orange-red for valid Bulldoze, and dark red for invalid Bulldoze. Keep all Preview materials transparent with `depthWrite: false`.

- [x] **Step 4: Add Bulldoze marker geometry**

For valid Bulldoze, add a line marker named `road-preview-bulldoze-marker` over each removed cell using the active footprint. The marker must sit above the Road surface enough to avoid z-fighting and use `bulldozeMarker`.

- [x] **Step 5: Run focused tests and commit**

Run:

```bash
pnpm --filter @web-three-city/road-three test -- road-preview-presentation.test.ts
pnpm --filter @web-three-city/road-three typecheck
```

Expected: PASS.

Commit:

```bash
git add packages/road-three
git commit -m "fix: distinguish Road operation previews"
```

### Task 2: Reliable Road release outside Terrain

**Files:**
- Modify: `apps/game/src/road-stroke-controller.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/test/road-stroke-controller.test.ts`
- Modify: `apps/game/test/game-input-road-preview.test.ts`

**Interfaces:**
- Changes: `RoadStrokeController.end(pointerId: number, cell: CellCoord | null): RoadMutationPlan | null`.
- Produces: release-with-null finalizes `session.plan` without extending the trace.

- [x] **Step 1: Write controller RED tests**

Add one test where a valid Build session begins and moves across cells, then calls `end(pointerId, null)`. Assert the returned plan is valid and contains the latest requested cells. Add an invalid/no-change counterpart asserting the invalid plan and reason are preserved.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run apps/game/test/road-stroke-controller.test.ts
```

Expected: TypeScript/test failure because `end()` does not accept `null`.

- [x] **Step 3: Implement optional release cell**

Change `end()` so it updates the trace only when `cell !== null`, then captures `session.plan`, clears Preview state, and returns the captured plan.

- [x] **Step 4: Change GameInput release routing**

When Road pointer-up cannot pick Terrain, call `roadController.end(pointerId, null)` instead of `roadController.cancel(pointerId)`. Continue routing valid plans to commit and invalid plans to status/reject handling. Leave Terraform behavior unchanged.

- [x] **Step 5: Verify controller and composition tests**

Run:

```bash
pnpm exec vitest run apps/game/test/road-stroke-controller.test.ts apps/game/test/game-input-road-preview.test.ts
pnpm --filter @web-three-city/game typecheck
```

Expected: PASS.

Commit:

```bash
git add apps/game/src/road-stroke-controller.ts apps/game/src/game-input.ts apps/game/test
git commit -m "fix: finalize Road strokes outside Terrain"
```

### Task 3: Explicit Road HUD operation state

**Files:**
- Modify: `apps/game/src/game-tool-hud-binding.ts`
- Modify: `apps/game/test/game-tool-hud-binding.test.ts`

**Interfaces:**
- Consumes: Road mode, `previewValid`, `strokeActive`, and invalid reason from existing `road-state` events.
- Produces exact labels: `Valid build`, `Invalid build`, `Valid bulldoze`, `Invalid bulldoze`.

- [x] **Step 1: Add RED label tests**

Dispatch Road state events for all four operation/validity combinations and assert the exact label and release/rejection detail.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run apps/game/test/game-tool-hud-binding.test.ts
```

Expected: FAIL because the HUD currently uses generic `Valid preview` / invalid wording.

- [x] **Step 3: Implement operation-aware copy**

Map `road-build` and `road-bulldoze` separately. Preserve counts and existing invalid reason text.

- [x] **Step 4: Verify and commit**

Run:

```bash
pnpm exec vitest run apps/game/test/game-tool-hud-binding.test.ts
pnpm --filter @web-three-city/game typecheck
```

Expected: PASS.

Commit:

```bash
git add apps/game/src/game-tool-hud-binding.ts apps/game/test/game-tool-hud-binding.test.ts
git commit -m "fix: expose Road operation Preview state"
```

### Task 4: Screen-relative camera pan basis

**Files:**
- Modify: `packages/camera-input/src/camera-interaction-controller.ts`
- Modify: `packages/camera-input/test/camera-interaction-controller.test.ts`

**Interfaces:**
- Preserves: `panScreen(delta: { x: number; y: number }): void`.
- Uses: camera world orientation through a camera accessor supplied by `OrthographicCameraRig`, or a rig method that returns projected right/up XZ basis vectors.

- [x] **Step 1: Replace quadrant-sign tests with projected-motion RED tests**

For yaw values 45°, 90°, 135°, 180°, 225°, 270°, 315°, and 17°, project a fixed world anchor to screen before and after `panScreen({x: 20, y: 0})`. Assert screen X increases and screen Y stays approximately stable. Repeat for `{x: 0, y: -20}` and assert screen Y decreases.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts
```

Expected: FAIL at rotated quadrants under the current manual sine/cosine formula.

- [x] **Step 3: Implement camera-derived basis**

Expose a rig method returning normalized horizontal screen right and up vectors projected onto XZ. Compute world delta as the screen delta multiplied by that basis and world-units-per-pixel, with signs chosen so content follows the pointer. Ignore degenerate/non-finite basis values.

- [x] **Step 4: Verify camera package**

Run:

```bash
pnpm --filter @web-three-city/camera-input test
pnpm --filter @web-three-city/camera-input typecheck
pnpm --filter @web-three-city/camera-input build
```

Expected: PASS.

Commit:

```bash
git add packages/camera-input
git commit -m "fix: keep camera pan screen-relative after rotation"
```

### Task 5: Built-application Chromium acceptance

**Files:**
- Create: `browser-tests/road-operation-aware-interaction.spec.ts`
- Modify: `browser-tests/interaction.spec.ts`
- Modify: `apps/game/src/interaction-evidence.ts` only if additional evidence fields are required.

**Interfaces:**
- Consumes existing Road HUD/evidence and canvas helpers.
- Produces screenshots and assertions for Build, Bulldoze, invalid Preview, outside-Terrain release, and rotated pan.

- [x] **Step 1: Add Road browser scenarios**

Add scenarios that:

1. show green valid Build Preview, release just outside the Terrain while pointer capture remains active, and assert occupied Road count increases;
2. show red invalid Build Preview and assert release does not mutate Road count;
3. create a Road, show orange-red Bulldoze Preview plus marker, release, and assert the Road count decreases.

- [x] **Step 2: Add camera browser scenario**

Rotate through all four quarter-turn orientations. At each orientation, record a selected Terrain anchor's screen position, perform a rightward pan gesture, and assert the anchor moves right. Repeat with upward pan and assert the anchor moves up.

- [x] **Step 3: Run focused Chromium**

Run:

```bash
pnpm build:browser
pnpm exec playwright test browser-tests/road-operation-aware-interaction.spec.ts browser-tests/interaction.spec.ts --project=chromium
```

Expected: PASS with screenshots attached for each Preview state.

- [x] **Step 4: Commit browser coverage**

```bash
git add browser-tests apps/game/src/interaction-evidence.ts
git commit -m "test: cover Road release and rotated camera pan"
```

### Task 6: Exact-head verification and cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-operation-aware-road-preview-release-camera-pan-design.md`
- Modify: `docs/superpowers/plans/2026-08-02-operation-aware-road-preview-release-camera-pan.md`

**Interfaces:**
- Produces exact-head verification evidence on `master`.

- [x] **Step 1: Run repository verification**

```bash
pnpm install --frozen-lockfile
pnpm check
```

Expected: PASS.

- [x] **Step 2: Run full browser verification**

```bash
pnpm test:browser
```

Expected: all Chromium/WebGL tests PASS.

- [x] **Step 3: Audit final tree**

```bash
git status --short
git diff --check HEAD~1..HEAD
find .github/workflows -maxdepth 1 -type f -print
```

Expected: clean tree, no whitespace errors, and only canonical workflows.

- [x] **Step 4: Record evidence**

Update the design/plan status with exact master SHA, test counts, workflow run IDs, artifact digest, and visual review result.

- [x] **Step 5: Final commit**

```bash
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: close operation-aware interaction verification"
```

---

## Final Verification Record

**Verdict:** COMPLETE

- Exact implementation tree: `a6601ca6fc27ef66b62f0d793fb7bc2a4ea39255`.
- Verification workflow run: `30741559482`.
- Artifact: `8831627313` (`sha256:e539930b91c16b1855984a0560e2d838bdc9d4bf54747dde38407ff3875f6e0e`).
- Focused Vitest: 29/29 passed.
- Full repository gate: `pnpm check` passed, including 297 unit tests and all workspace builds.
- Focused Chromium: 2/2 passed.
- Full Chromium/WebGL: 103/103 passed in 14.7 minutes.
- Temporary workflows, triggers, and runner scripts: removed from the final tree.
- Vercel deployment policy: manual-only (`git.deploymentEnabled: false`).
