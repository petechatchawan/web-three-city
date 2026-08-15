# Citizen / Traffic Inspect + Information View v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the frozen City UI with Citizen/Pedestrian Inspect, Vehicle Inspect, and a Traffic Information View while preserving M6.4 presentation authority, interaction layering, EN/TH localization, and world-input guarantees.

**Architecture:** UI consumes immutable projections from the committed Mobility/Traffic application seams. Existing bounded `InspectSurface` remains the only contextual inspect presentation; Traffic adds target kinds and projection fields, not a new panel. Traffic Information View registers in the existing single-active Information View registry and renders only derived congestion/load overlay state.

**Tech Stack:** existing `apps/game/src/ui/**` Vanilla TypeScript/DOM/CSS, Vitest, Playwright, existing City UI locale seam and Three.js overlay integration.

## Global Constraints

- Do not redesign M6.4 Build/City/bottom chrome/Inspect layout.
- Inspect target/projection reads committed state only and never mutates Citizen/Mobility/Traffic.
- Visible pedestrian/vehicle pick results must resolve to real committed `citizenId` + `tripId`.
- UI must not invent Citizen names if RCI has no name authority.
- Traffic overlay must not become Traffic authority.
- Only one Information View remains active.
- EN/TH copy uses the existing localization seam; no scattered locale conditionals.
- 414×896 portrait remains canonical mobile acceptance viewport.
- Opening/closing Inspect/Traffic view must not change active tool, Simulation speed, Undo, or Mobility/Traffic state.

---

# PR10 — Citizen/Vehicle Inspect + Traffic Information View

**Branch:** `feat/city-ui-citizen-traffic-inspect-v0-1`

## Task 1: Add Citizen and Vehicle inspect target kinds

**Files:**
- Modify: `apps/game/src/ui/inspect/inspect-target.ts`
- Modify: `apps/game/src/ui/inspect/inspect-target.test.ts`
- Create: `apps/game/src/traffic-inspect-target.ts`
- Test: `apps/game/src/traffic-inspect-target.test.ts`

**Target additions:**

```ts
import type { CellCoord } from '@web-three-city/world-core';

export type InspectTarget =
  | Readonly<{
      kind: 'building' | 'road' | 'zone' | 'terrain';
      cell: CellCoord;
    }>
  | Readonly<{
      kind: 'citizen';
      citizenId: string;
      tripId: string | null;
    }>
  | Readonly<{
      kind: 'vehicle';
      citizenId: string;
      tripId: string;
    }>;
```

Keep the existing `pickInspectTarget(world, cell)` function for cell targets. `traffic-inspect-target.ts` owns translation from Three.js agent hit metadata into Citizen/Vehicle targets so generic target code does not import `traffic-three` implementation classes.

- [ ] **RED:** hit on materialized pedestrian returns `kind:'citizen'` with exact real IDs.
- [ ] **RED:** hit on materialized vehicle returns `kind:'vehicle'` with exact real IDs.
- [ ] **RED:** malformed/anonymous object metadata does not create a canonical Citizen/Vehicle target.
- [ ] **RED:** existing Building > Road > Zone > Terrain target priority remains unchanged when no Traffic agent is hit.
- [ ] Implement narrow hit adapter + target union without changing existing cell target behavior.
- [ ] Run focused GREEN.
- [ ] Commit `feat(city-ui): add citizen and vehicle inspect targets`.

## Task 2: Add immutable Citizen/Vehicle inspect projections

**Files:**
- Modify: `apps/game/src/ui/inspect/inspect-projections.ts`
- Modify: `apps/game/src/ui/inspect/inspect-projections.test.ts`
- Create: `apps/game/src/ui/inspect/traffic-inspect-projections.ts`
- Test: `apps/game/src/ui/inspect/traffic-inspect-projections.test.ts`

**Consumes:** application-supplied immutable projection containing RCI identity references, Mobility activity/trip, and Traffic route/congestion facts.

**Citizen fields only when available:**

```text
Citizen ID
Household ID
Home Building
Workplace / Employment
Current Activity
Trip Purpose
Travel Mode
Destination
Travel State / ETA
```

**Vehicle fields:**

```text
Citizen ID
Trip ID
Purpose
Origin
Destination
Current Road/route edge
Queued/Moving state
Congestion
Estimated travel time
```

- [ ] **RED:** no fake `Name` field is emitted when source has none.
- [ ] **RED:** stationary Citizen can render activity/Home/Work without active trip.
- [ ] **RED:** Walk trip shows Citizen semantics; Drive vehicle projection shows linked Citizen/trip.
- [ ] **RED:** target whose trip disappeared after committed refresh returns unavailable/updated projection rather than stale fields.
- [ ] Implement projection factory and hook into `createInspectProjection(...)`.
- [ ] GREEN.
- [ ] Commit `feat(city-ui): project citizen and vehicle inspect details`.

## Task 3: Reuse existing bounded InspectSurface lifecycle

**Files:**
- Modify: `apps/game/src/ui/inspect/inspect-surface.ts` only if generic rendering needs additional field semantics; do not fork a traffic-specific surface.
- Modify: `apps/game/src/ui/city-ui-runtime.ts` to pass refreshed Citizen/Traffic projections through existing target refresh path.
- Test: `apps/game/src/ui/city-ui-runtime.test.ts`
- Test: `apps/game/src/ui/inspect/inspect-projections.test.ts`

- [ ] **RED:** selecting person A then car B reuses one `.inspect-surface` instance and reprojects content.
- [ ] **RED:** opening Build collapses expanded Traffic/Citizen Inspect exactly like existing targets.
- [ ] **RED:** closing Inspect changes no Mobility/Traffic snapshot fingerprint and no tool/speed state.
- [ ] **RED:** expanded surface remains within existing M6.4 height bound.
- [ ] Implement only generic refresh wiring.
- [ ] GREEN.
- [ ] Commit `feat(city-ui): integrate traffic targets with inspect surface`.

## Task 4: Register Traffic Information View

**Files:**
- Modify: `apps/game/src/ui/information-views/information-view-registry.ts`
- Modify: `apps/game/src/ui/information-views/information-view-registry.test.ts`
- Create: `apps/game/src/traffic-information-view.ts`
- Create: `apps/game/src/traffic-information-view.test.ts`

**Registry addition:**

```ts
{
  id: 'traffic',
  labelKey: 'informationView.traffic'
}
```

**Derived overlay input:**

```ts
export interface TrafficInformationEdge {
  readonly edgeId: string;
  readonly congestionMilli: number;
  readonly loadRatioMilli: number;
  readonly queueDelaySeconds: number;
  readonly worldPath: readonly Readonly<{ x: number; y: number; z: number }>[];
}
```

- [ ] **RED:** registry permits exactly one active view and includes Traffic.
- [ ] **RED:** edge projection normalizes congestion to accessible severity token (`free`, `moderate`, `heavy`, `congested`) without changing Traffic metrics.
- [ ] **RED:** disabling view disposes/hides overlay and leaves Traffic state unchanged.
- [ ] Implement Three.js overlay adapter in `traffic-information-view.ts`; do not store derived color/severity in `traffic-core`.
- [ ] GREEN.
- [ ] Commit `feat(city-ui): add traffic information view`.

## Task 5: Extend EN/TH locale catalog through the existing seam

**Files:**
- Modify: `apps/game/src/ui/presentation-locale.ts`
- Test: extend the existing locale test that owns `presentation-locale.ts`; if no dedicated file exists at PR10 start, add `apps/game/src/ui/presentation-locale.test.ts` rather than a second catalog implementation.

**Required keys:**

```text
inspect.citizen
inspect.vehicle
inspect.citizenId
inspect.household
inspect.home
inspect.work
inspect.activity
inspect.tripPurpose
inspect.travelMode
inspect.destination
inspect.travelState
inspect.eta
inspect.currentRoad
inspect.congestion
informationView.traffic
traffic.free
traffic.moderate
traffic.heavy
traffic.congested
```

- [ ] **RED:** every required key resolves in `en` and `th` through `uiText`/existing catalog API.
- [ ] **RED:** invalid locale still falls back deterministically to English.
- [ ] Add one catalog row per key; do not mirror whole locale objects.
- [ ] GREEN.
- [ ] Commit `feat(city-ui): localize citizen traffic presentation`.

## Task 6: Focused Playwright RED → GREEN at canonical viewport

**Files:**
- Create: `browser-tests/citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts`
- Modify existing browser fixture/harness only where needed to produce a deterministic committed traffic scenario.

**Scenarios:**

1. **Pedestrian Inspect**
   - build deterministic city/fixture with one active Walk trip,
   - set viewport 414×896,
   - click materialized pedestrian,
   - assert one bounded Inspect surface,
   - assert real Citizen ID/trip mode/destination fields,
   - assert no generic 90vh dialog.

2. **Vehicle Inspect**
   - click materialized Drive vehicle,
   - assert linked Citizen + Trip + Road/congestion fields,
   - change selected vehicle and assert same Inspect surface instance is reused.

3. **Traffic Information View**
   - open City → Information Views → Traffic,
   - assert Traffic becomes sole active information view,
   - assert overlay exists for committed edge projections,
   - disable and assert overlay disappears.

4. **EN/TH layout**
   - switch Thai,
   - inspect Citizen and Traffic view,
   - assert no horizontal document overflow at 414×896.

5. **Authority preservation**
   - capture Mobility/Traffic revision/debug fingerprint + active tool + Simulation speed before opening/closing Inspect/Traffic view,
   - assert presentation actions do not mutate those authorities.

- [ ] Write tests first and run focused RED:

```bash
pnpm build:browser
pnpm exec playwright test browser-tests/citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts --project=chromium
```

Expected: semantic failures for missing target/projection/view behavior, not harness failures.

- [ ] Complete production/UI wiring until focused suite GREEN.

- [ ] Run PR10 exact-head gate:

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm check
pnpm build:browser
pnpm exec playwright test browser-tests/citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts --project=chromium
node tooling/verify-clean-worktree.mjs
```

Expected: PASS.

## Task 7: Documentation and handoff

**Files:**
- Modify: `docs/systems/city-ui/README.md`
- Add: `docs/systems/city-ui/verification/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md`

- [ ] Record that M6.4 shell remains frozen and this milestone only extends registered Inspect/Information View content.
- [ ] Record exact candidate SHA, RED/GREEN commands, focused Playwright results and canonical viewport.
- [ ] Commit docs and squash-merge PR10.

---

## PR10 Acceptance Boundary

PR10 proves UI integration and layout. It does **not** close Citizen Mobility & Traffic Foundation by itself. Full commute visual behavior, Save/reload, topology mutation, materialization/performance and owner visual acceptance remain PR11 gates in the cross-system execution index.

## Related Plans

- Execution index: `../../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md`
- Traffic: `../../traffic/tdd/2026-08-15-traffic-foundation-v0-1.md`
- World: `../../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md`
