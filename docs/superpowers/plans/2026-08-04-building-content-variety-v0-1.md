# Building Content Variety v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Building catalog from six to twelve deterministic definitions and render distinct active and Construction prototypes without moving simulation authority into presentation.

**Architecture:** `building-core` owns definition metadata and deterministic weighted selection. `building-three` owns disposable cube-composed presentation for the twelve active prototypes and three derived Construction phases. Selection consumes only stable Growth inputs and never calls `Math.random`.

**Tech Stack:** TypeScript 6, Three.js 0.185, Vitest 4, pnpm workspaces, existing Building footprint/frontage contracts.

## Global Constraints

- Preserve all six existing Definition IDs and Definition version `1`.
- Add exactly six Definition IDs for a twelve-definition catalog.
- Selection is deterministic and uses a stable unsigned 32-bit hash.
- Weight selection occurs only inside the highest valid `selectionPriority` tier.
- Adjacent duplicate avoidance may filter a matching definition only when a non-matching valid alternative exists.
- Construction phases are derived and are never persisted.
- Tests are authored before implementation and executed only at the final milestone verification by Owner instruction.

---

## File map

### Create

- `packages/building-core/src/building-selection.ts` — stable hash, weighted selection, adjacency filtering.
- `packages/building-core/test/building-selection.test.ts` — deterministic and reachability coverage.
- `packages/building-three/src/construction-prototype-factory.ts` — foundation/frame/shell groups.
- `packages/building-three/test/construction-prototype-factory.test.ts` — phase geometry and naming.

### Modify

- `packages/building-core/src/contracts.ts` — extend Definition and Prototype ID unions.
- `packages/building-core/src/building-definitions.ts` — add six Definitions and final weights.
- `packages/building-core/src/building-growth.ts` — delegate choice to `building-selection.ts`.
- `packages/building-core/src/index.ts` — export selection contracts.
- `packages/building-core/test/building-definitions.test.ts` — exact twelve-definition catalog.
- `packages/building-core/test/building-growth.test.ts` — weighted and adjacency integration.
- `packages/building-three/src/prototype-factory.ts` — add six active prototypes and preserve existing six.
- `packages/building-three/src/building-presentation.ts` — select Construction or Active presentation from lifecycle/progress.
- `packages/building-three/src/index.ts` — export Construction helpers needed for tests only when intentionally public.
- `packages/building-three/test/building-presentation.test.ts` — twelve active silhouettes and three Construction phases.

---

### Task 1: Lock the twelve-definition catalog in tests

**Required catalog:**

```ts
const EXPECTED_IDS = [
  'commercial-cafe-1x1',
  'commercial-market-1x2',
  'commercial-office-2x2',
  'commercial-shop-1x1',
  'industrial-depot-1x1',
  'industrial-factory-2x2',
  'industrial-warehouse-2x2',
  'industrial-workshop-1x2',
  'residential-apartment-2x2',
  'residential-cottage-1x1',
  'residential-duplex-2x1',
  'residential-rowhouse-1x2',
];
```

- [ ] **Step 1: Author tests** asserting exact IDs, unique IDs, version `1`, non-empty compatible Zone lists, positive integer weights, duration `24 × area`, valid rotations, and prototype IDs.
- [ ] **Step 2: Extend `BuildingDefinitionId` and `BuildingPrototypeId` unions** with `duplex`, `apartment`, `cafe`, `market`, `depot`, and `factory`.
- [ ] **Step 3: Add the Residential Duplex 2×1** with priority `20`, weight `20`, height `1.1`, and all rotations.
- [ ] **Step 4: Add the Residential Apartment 2×2** with priority `30`, weight `10`, height `2.4`, and all rotations.
- [ ] **Step 5: Add the Commercial Cafe 1×1** with priority `10`, weight `30`, height `0.85`, and all rotations.
- [ ] **Step 6: Add the Commercial Market 1×2** with priority `20`, weight `20`, height `1.2`, and all rotations.
- [ ] **Step 7: Add the Industrial Depot 1×1** with priority `10`, weight `30`, height `0.75`, and all rotations.
- [ ] **Step 8: Add the Industrial Factory 2×2** with priority `30`, weight `15`, height `1.8`, and all rotations.
- [ ] **Step 9: Order the frozen catalog by Zone family and stable Definition ID while preserving lookup behavior.**
- [ ] **Step 10: Record expected focused command:** `pnpm --filter @web-three-city/building-core test -- building-definitions.test.ts`.

### Task 2: Implement stable weighted selection

**Interfaces:**

```ts
export interface BuildingSelectionCandidate {
  readonly definition: BuildingDefinition;
  readonly instance: BuildingInstance;
  readonly frontage: BuildingFrontage;
}

export interface BuildingSelectionContext {
  readonly absoluteTick: number;
  readonly growthSequence: number;
  readonly originCell: CellCoord;
  readonly zoneDefinitionId: ZoneDefinitionId;
  readonly adjacentDefinitionIds: ReadonlySet<BuildingDefinitionId>;
}

export function stableBuildingSelectionHash(context: Omit<BuildingSelectionContext, 'adjacentDefinitionIds'>): number;
export function selectBuildingCandidate(
  candidates: readonly BuildingSelectionCandidate[],
  context: BuildingSelectionContext,
): BuildingSelectionCandidate | null;
```

- [ ] **Step 1: Author tests** proving identical input gives identical hash, one-field changes affect the sequence, result is unsigned 32-bit, zero/negative weights are rejected by definition validation, and no runtime random source is called.
- [ ] **Step 2: Implement FNV-1a over the UTF-8-compatible ASCII key** `${absoluteTick}|${growthSequence}|${x},${z}|${zoneDefinitionId}` using `Math.imul` and `>>> 0`.
- [ ] **Step 3: Sort candidates by descending priority, then `definition.id`, then existing rotation/frontage order.**
- [ ] **Step 4: Keep only the highest priority tier containing valid candidates.**
- [ ] **Step 5: If a non-adjacent definition exists, remove candidates whose Definition ID appears in `adjacentDefinitionIds`; otherwise retain all candidates.**
- [ ] **Step 6: Collapse multiple rotations for the same Definition to that Definition's best ordered candidate.**
- [ ] **Step 7: Compute `hash % totalWeight` and select by cumulative weight ordered by Definition ID.**
- [ ] **Step 8: Record expected focused command:** `pnpm --filter @web-three-city/building-core test -- building-selection.test.ts`.

### Task 3: Integrate variety selection into Growth

- [ ] **Step 1: Author Growth integration tests** with controlled valid candidates that demonstrate at least two Definition outcomes across different sequences, deterministic replay for equal state, and adjacent duplicate avoidance.
- [ ] **Step 2: Derive adjacent Definition IDs** from Building instances occupying orthogonally adjacent cells around the candidate footprint.
- [ ] **Step 3: Build candidates for every valid Definition and allowed rotation instead of accepting the first Definition.**
- [ ] **Step 4: Delegate candidate selection to `selectBuildingCandidate`.**
- [ ] **Step 5: Preserve row-major origin selection:** variety chooses content only after the first origin with at least one valid candidate is found.
- [ ] **Step 6: Preserve one-start-per-evaluation and existing fail-closed reasons.**
- [ ] **Step 7: Record expected focused command:** `pnpm --filter @web-three-city/building-core test -- building-growth.test.ts building-selection.test.ts`.

### Task 4: Add six active low-poly prototypes

**Prototype requirements:**

```text
Duplex: two attached bodies and two roof/entry cues
Apartment: tall 2×2 mass with repeated window-band blocks
Cafe: compact shop body with canopy and roof sign
Market: elongated body with canopy strip and rear service block
Depot: low compact shed with loading-door block
Factory: 2×2 hall with sawtooth-like stepped roof blocks and chimney
```

- [ ] **Step 1: Author prototype tests** asserting every Prototype ID creates a frozen/named Group with at least one Mesh and a distinct deterministic child-name signature.
- [ ] **Step 2: Keep existing prototype functions behaviorally stable.**
- [ ] **Step 3: Add focused factory functions for the six new prototypes using only shared BoxGeometry/material helpers.**
- [ ] **Step 4: Ensure each prototype is centered inside canonical footprint bounds before Building-level world translation/rotation.**
- [ ] **Step 5: Add stable child names such as `body`, `roof`, `canopy`, `chimney`, and `window-band` for evidence and tests.**
- [ ] **Step 6: Record expected focused command:** `pnpm --filter @web-three-city/building-three test -- building-presentation.test.ts`.

### Task 5: Add Construction phase prototypes

**Interfaces:**

```ts
export type ConstructionVisualPhase = 'foundation' | 'frame' | 'shell';

export function constructionVisualPhase(progress: number): ConstructionVisualPhase;
export function createConstructionPrototype(input: {
  readonly footprintWidth: number;
  readonly footprintDepth: number;
  readonly prototypeHeight: number;
  readonly phase: ConstructionVisualPhase;
}): THREE.Group;
```

- [ ] **Step 1: Author boundary tests** for `0`, `1/3`, just above `1/3`, `2/3`, just above `2/3`, and values clamped outside `[0,1]`.
- [ ] **Step 2: Implement phase derivation:** `progress <= 1/3` foundation, `<= 2/3` frame, otherwise shell.
- [ ] **Step 3: Build foundation** as a shallow footprint slab plus perimeter markers.
- [ ] **Step 4: Build frame** as foundation plus corner columns and top beams.
- [ ] **Step 5: Build shell** as foundation plus partial body and unroofed/unfinished top blocks.
- [ ] **Step 6: Give roots stable names:** `building-construction-foundation`, `building-construction-frame`, and `building-construction-shell`.
- [ ] **Step 7: Record expected focused command:** `pnpm --filter @web-three-city/building-three test -- construction-prototype-factory.test.ts`.

### Task 6: Make Building presentation lifecycle-aware

- [ ] **Step 1: Author presentation tests** creating Construction instances at each progress phase and Active instances for all twelve Prototype IDs.
- [ ] **Step 2: Extend presentation rebuild input with authoritative `absoluteTick`.**
- [ ] **Step 3: For Construction, derive progress from lifecycle ticks and build the corresponding Construction prototype.**
- [ ] **Step 4: For Active, route to the Definition's active prototype exactly as before.**
- [ ] **Step 5: Attach `instanceId`, `lifecycle`, and derived `constructionPhase` to `group.userData`; never mutate the instance.**
- [ ] **Step 6: Preserve one committed root and disposal behavior.**
- [ ] **Step 7: Record expected focused command:** `pnpm --filter @web-three-city/building-three test`.

### Task 7: Review deterministic and presentation boundaries

- [ ] **Step 1: Search changed core files for `Math.random`, `Date`, `performance`, `window`, `document`, and `three`; all searches must be empty.**
- [ ] **Step 2: Verify `building-three` never imports Simulation mutation functions.**
- [ ] **Step 3: Verify no Construction phase/progress is added to Building Save authority.**
- [ ] **Step 4: Commit PR 2 with message:** `feat: add deterministic Building content variety`.

## Deferred final verification

Do not execute the authored tests inside this PR. The complete workspace and browser gate runs once after PR 3 implementation is complete. Failures attributable to catalog, selection, or presentation are repaired on the PR 2 branch and propagated through the stacked PR 3 branch before the full gate is rerun.
