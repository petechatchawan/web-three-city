# Road / Traffic Browser Audit — PR-T3.1

**Status:** Audit only — no migration authorized  
**Parent audit:** `browser-test-classification-audit.md`  
**Audit base:** `e6b956c37835f1fc617587001ebd6e79eff6e0a2`

## Scope

This is the detailed pilot audit for the current `@road|@traffic` browser surface. The audited files account for **60 Chromium tests** across Road, Traffic, shared Road/Traffic recovery, and Road-tagged inspect coverage.

The objective is not to remove Playwright coverage. It is to identify which facts should eventually be proven lower and which facts must remain browser/Three.js authority.

## Classification legend

- `DOMAIN_LOGIC_CANDIDATE` — deterministic domain rule; future Vitest unit target.
- `APPLICATION_INTEGRATION` — deterministic multi-system/application fact; future Vitest integration target.
- `BROWSER_CONTRACT` — DOM/CSS/layout/accessibility/locale fact; keep browser.
- `THREEJS_INTEGRATION` — canvas/input/camera/render/WebGL fact; keep browser.
- `CRITICAL_E2E` — bounded user journey; keep a representative browser journey.
- `EVIDENCE_PERFORMANCE` — visual/performance evidence; keep browser.

`SPLIT` means the test currently combines lower-layer proof with browser authority. It remains in Playwright until replacement proof is GREEN.

# Road audit

## `road.@road.spec.ts` — 30 tests

| Current test(s) | Count | Category | Browser required now? | Audit decision | Future action | Risk |
|---|---:|---|---|---|---|---|
| `renders valid <fixture> deterministically` for isolated/end/straight/corner/T/four-way/ramp/chunk-boundary fixtures | 21 | `THREEJS_INTEGRATION` | YES | **SPLIT** — deterministic validity/topology matrix is lower-layer proof, but committed render root / preview root / geometry / cross-chunk presentation facts are Three.js facts | move exhaustive topology/validity assertions to Road/Road-three deterministic tests; retain representative browser fixtures for geometry/render roots/chunk seam | HIGH if browser matrix is deleted before replacement |
| `renders invalid <fixture> Preview` for perpendicular-ramp, ramp-junction, wet-cell | 3 | `THREEJS_INTEGRATION` | YES | **SPLIT** — invalid reason is deterministic; preview-root rendering is browser/Three authority | move invalid-reason matrix lower; keep representative invalid preview browser evidence | HIGH |
| `desktop drag previews and commits one Road transaction without touching Water` | 1 | `THREEJS_INTEGRATION` | YES | KEEP browser journey; transaction/water revision assertions may also exist lower | keep pointer/preview/commit browser authority; avoid duplicating all deterministic state facts in future | MEDIUM |
| `Bulldoze updates topology and tagged Undo restores the Road only` | 1 | `CRITICAL_E2E` | YES | KEEP bounded build→bulldoze→undo journey; topology/undo state is also a lower-layer candidate | retain one browser journey, move exhaustive undo/topology permutations lower | MEDIUM |
| `second touch cancels Road Preview and transfers to camera gesture ownership` | 1 | `THREEJS_INTEGRATION` | YES | KEEP | no migration; real pointer ownership/canvas gesture contract | LOW |
| `Terraform touching one Road cell invalidates Preview and rejects the whole transaction` | 1 | `THREEJS_INTEGRATION` | YES | **SPLIT** — Terraform/Road incompatibility is deterministic, preview/status interaction is browser authority | add/retain deterministic cross-system integration proof; keep one browser rejection journey | MEDIUM |
| `WorldSaveV7 restores Roads and legacy Terrain saves migrate to empty Roads` | 1 | `CRITICAL_E2E` | YES | **SPLIT** — codec/migration state is deterministic; localStorage/menu/load journey is browser integration | prove codec/migration exhaustively lower; keep thin browser save/load acceptance | MEDIUM |
| `WebGL context restoration keeps committed Roads and clears Preview` | 1 | `THREEJS_INTEGRATION` | YES | KEEP | no downward migration for WebGL lifecycle fact | LOW |

### Finding R1

The 24 generated Terrain Lab validity/invalidity cases are the largest obvious optimization seam. They should **not** simply disappear. Their deterministic topology/validity matrix should move to a lower layer, while a small representative set stays in Chromium to prove Road-three geometry, render roots, invalid preview, and cross-chunk presentation.

## `road-operation-aware-interaction.@road@interaction.spec.ts` — 2 tests

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `Road operations expose distinct Preview and release outside Terrain commits the latest plan` | `THREEJS_INTEGRATION` | YES | KEEP | pointer ownership, canvas release semantics and screenshot evidence remain browser authority |
| `camera pan remains screen-relative after every quarter-turn rotation` | `THREEJS_INTEGRATION` | YES | KEEP | real camera/input mapping; no pure-domain replacement |

## `road-reversible-stroke.@road@interaction.spec.ts` — 3 tests

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `Build Preview stays isolated and exact reverse removes the abandoned tail` | `THREEJS_INTEGRATION` | YES | KEEP | reversible pointer path, preview bounds and pixel evidence are Three.js/browser facts |
| `reverse then perpendicular movement branches from the retained Road tail` | `THREEJS_INTEGRATION` | YES | KEEP | same; lower planner tests may supplement but not replace browser gesture proof |
| `Bulldoze reverse restores the abandoned removal tail before release` | `THREEJS_INTEGRATION` | YES | KEEP | same |

## `road-visibility.@road@visual.spec.ts` — 1 test

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `Road Preview and committed Road change visible pixels at the target cell` | `EVIDENCE_PERFORMANCE` | YES | KEEP | visible-pixel proof is intentionally browser-owned |

## `road-visual-evidence.@road@visual@release.spec.ts` — 6 tests

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `captures Road topology overview` | `EVIDENCE_PERFORMANCE` | YES | KEEP | visual evidence |
| `captures both-axis Ramp alignment` | `EVIDENCE_PERFORMANCE` | YES | KEEP | visual evidence |
| `captures invalid Preview feedback` | `EVIDENCE_PERFORMANCE` | YES | KEEP | visual evidence |
| `captures cross-chunk Road continuity` | `EVIDENCE_PERFORMANCE` | YES | KEEP | visual evidence |
| `captures the canonical mobile Game Road Build context` | `EVIDENCE_PERFORMANCE` | YES | KEEP | mobile visual/UI evidence |
| `replaces Local Street with Collector and Arterial without duplicating occupancy` | `CRITICAL_E2E` | YES | **SPLIT** — replacement compatibility/occupancy is deterministic, but mobile tool selection + rendered evidence is a real journey | prove Road type replacement semantics lower; keep a thin mobile replacement acceptance and screenshot |

## `transaction-release.@road@interaction.spec.ts` — 1 test

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `Road pointer capture released outside the map commits the latest valid plan once` | `THREEJS_INTEGRATION` | YES | KEEP | browser pointer capture/release semantics are the authority |

## `city-ui-inspect-information.@interaction@building@road@zoning.spec.ts` — 2 tests

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `inspects terrain and replaces then deactivates the primary information view` | `BROWSER_CONTRACT` | YES | KEEP | inspect surface, information-view replacement and DOM visibility are browser facts |
| `uses Road over Zone and preserves the derived Growth evaluation boundary` | `BROWSER_CONTRACT` | YES | **SPLIT** — inspect priority is UI authority; Growth boundary is deterministic application state | keep inspect-priority browser assertion; move Growth-boundary proof lower if not already authoritative there |

# Traffic audit

## `citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts` — 2 tests

| Test | Category | Browser required? | Decision | Future action | Risk |
|---|---|---|---|---|---|
| `morning commute exposes only authoritative lifecycle and materialization facts` | `CRITICAL_E2E` | YES | **SPLIT** — screenshot/materialization caps are browser/presentation facts; citizen/mode/lifecycle/time-cursor assertions are deterministic application facts | retain one commute acceptance + screenshot; move exhaustive lifecycle/mode/cursor invariants to Mobility/Traffic/Game Vitest | HIGH |
| `active Drive trips publish phase and resource facts without synthetic replay` | `APPLICATION_INTEGRATION` | NO after replacement | MIGRATION CANDIDATE, not authorized yet | add/confirm deterministic application integration proof; remove/narrow browser-only state polling only after GREEN replacement | MEDIUM |

## `citizen-mobility-traffic-mobile-regression.@traffic@interaction@release.spec.ts` — 7 tests

Six generated viewport cases cover canonical portrait, secondary portrait, compact landscape, rotated landscape, tablet landscape, and desktop landscape.

| Test(s) | Count | Category | Browser required? | Decision | Future action |
|---|---:|---|---|---|---|
| `<viewport>: Traffic UI preserves mobile shell bounds` | 6 | `BROWSER_CONTRACT` | YES | KEEP | real viewport, layout, bounding boxes, CSS grid and RCI row geometry must stay browser-owned |
| `Traffic information view does not synthesize Navigate, clear active tool, or mutate speed` | 1 | `BROWSER_CONTRACT` | YES | KEEP thin browser regression; speed non-mutation may also be proven lower | preserve UI/tool continuity; avoid expanding deterministic assertions here |

## `citizen-mobility-traffic-performance.@traffic@release.spec.ts` — 1 test

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `5,000 logical trips remain spatially bounded and presentation-capped` | `EVIDENCE_PERFORMANCE` | YES | KEEP | rAF timing, presentation culling, visible caps, pool reuse and browser memory/timing evidence remain browser authority |

### Finding T1

This test must not be migrated to Node/Vitest merely because some counters are deterministic. Its core evidence uses `requestAnimationFrame`, browser timing, presentation materialization/culling and runtime pool reuse.

## `citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts` — 1 test

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `bulldozing a future route edge recovers the active trip without orphaning its Citizen` | `CRITICAL_E2E` | YES | **SPLIT** — Road UI mutation is a real journey; reroute/revision/Citizen/trip state is deterministic application behavior | move exhaustive topology-recovery state proof to Traffic/Game integration tests; retain one Road→Traffic recovery browser acceptance |

## `citizen-mobility-traffic-save-load.@traffic@release.spec.ts` — 1 test

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `WorldSaveV8 restores calendar, cursor, lifecycle, and reservation authority exactly` | `CRITICAL_E2E` | YES | **SPLIT** — exact codec/session state should be deterministic; browser localStorage + live resume is acceptance authority | prove schema/migration/round-trip equality lower; retain thin browser save→advance→load→continue journey |

## `citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts` — 3 tests

| Test | Category | Browser required? | Decision | Future action |
|---|---|---|---|---|
| `exposes committed Mobility/Traffic debug state without changing the frozen shell` | `BROWSER_CONTRACT` | YES | KEEP shell/browser portion; deterministic state existence can be lower | narrow later only after lower proof exists |
| `registers Traffic as the single active information view and supports Thai copy` | `BROWSER_CONTRACT` | YES | KEEP | DOM interaction, information-view selection, accessible Thai copy and overflow are browser facts |
| `opening presentation surfaces does not mutate Mobility/Traffic authority` | `APPLICATION_INTEGRATION` | NO after replacement | MIGRATION/SPLIT CANDIDATE | prove presentation commands do not mutate domain snapshots in deterministic Game/application tests; optionally retain a minimal UI regression |

# Pilot summary

## Keep browser authority

The following classes should remain Playwright/browser-owned:

- Road pointer capture, touch ownership, reversible stroke interaction and release semantics.
- Camera pan after rotation.
- Road preview/committed visible-pixel evidence.
- WebGL context restoration.
- Mobile Road visual evidence and Road build context.
- Inspect DOM/information-view behavior.
- Traffic responsive layout across real viewports.
- Traffic locale/accessibility/overflow contracts.
- 5,000-trip Traffic presentation/performance evidence.
- A small number of bounded Road/Traffic user journeys (build/undo, recovery, save/load, commute).

## Strong downward-migration candidates

These facts should be targeted first in a future PR-T3.2 RED/GREEN migration:

1. Road fixture validity/topology matrix currently repeated in Chromium.
2. Road invalid-reason matrix.
3. Road type replacement compatibility / non-duplicated occupancy.
4. Traffic active Drive phase/resource facts that only poll committed debug state.
5. Traffic lifecycle/mode/time-cursor invariants embedded in the commute acceptance.
6. Traffic recovery state after Road topology revision.
7. Traffic WorldSaveV8 exact schema/round-trip/lifecycle/reservation equality.
8. Presentation-open commands not mutating Mobility/Traffic authority.
9. Growth-boundary assertions embedded in Road-tagged inspect UI coverage.

## Split strategy

For every split candidate:

```text
existing Playwright proof
        ↓
write lower-layer RED proof
        ↓
make/confirm GREEN at owner layer
        ↓
keep or narrow the browser assertion that proves browser/Three/UI authority
        ↓
run exact-head verification
        ↓
only then remove duplicated browser-only deterministic assertions
```

No browser test should be deleted solely because it appears in this migration-candidate list.

# Recommended PR-T3.2 pilot order

If PR-T3.1 is approved separately, the safest migration order is:

1. **Road deterministic fixture matrix** — highest browser repetition, clean deterministic owner boundary.
2. **Traffic state-only integration assertions** — active-drive facts and presentation non-mutation.
3. **Traffic persistence/recovery deterministic proof** — retain thin E2E journeys.
4. **Road type replacement deterministic compatibility** — retain mobile/visual acceptance.

Do **not** start with camera, pointer capture, reversible-stroke pixels, responsive layout, visual evidence, WebGL restoration, or Traffic performance. Those are already executing at their correct authority layer.

# Non-goals

This audit does not change any Playwright source, production source, CI workflow, test tag, worker/retry setting, browser configuration, or release gate. It creates no permission to reduce the current 60-test Road/Traffic browser union until replacement authority is implemented and GREEN in a separate PR.