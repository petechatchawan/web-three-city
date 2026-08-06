# RCI PR 1 — Core Contracts, Registries, Snapshots, and Save V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Execute each checkbox in order. Do not begin PR 2 work on this branch.

**Goal:** Add the framework-free `@web-three-city/rci-core` package with normalized authoritative records, validated definition registries, immutable revisioned snapshots, typed errors, canonical `RciSaveV1`, and the `WorldSaveV5` envelope/migration foundation.

**Architecture:** `rci-core` owns RCI records and validation while consuming stable Building, Simulation, World, and Zone contracts. Runtime indexes and projections are reconstructible and excluded from Save. `apps/game/src/world-save.ts` remains the world-envelope owner and composes package-level decoders without moving simulation logic into the app.

**Tech Stack:** TypeScript 6, pnpm workspaces, Vitest 4, immutable plain records, `Result` from `world-core`, existing plan/commit and serialization conventions.

## Global Constraints

- No DOM, Three.js, browser global, real time, locale-dependent decision ordering, or `Math.random()` in `packages/rci-core`.
- Generated IDs are stable strings backed by persisted safe-integer sequences.
- A failed constructor, decoder, validator, or commit consumes no sequence values.
- Definition IDs are open strings; registry construction rejects duplicate IDs and dangling references.
- Save arrays are sorted by explicit stable IDs before encoding.
- Decode of untrusted input returns `Result<RciSnapshot, RciSaveError>`.
- Contract misuse and stale commits throw `RciContractError`.
- PR 1 does not implement births, deaths, migration decisions, housing matching, employment matching, demand evaluation, HUD, or runtime tick orchestration.
- Update the living RCI overview to `Partial` when this PR is implemented.

---

## Task 1: Scaffold `@web-three-city/rci-core`

**Files:**
- Create: `packages/rci-core/package.json`
- Create: `packages/rci-core/tsconfig.json`
- Create: `packages/rci-core/tsconfig.build.json`
- Create: `packages/rci-core/vitest.config.ts`
- Create: `packages/rci-core/src/index.ts`
- Create: `packages/rci-core/test/package-boundary.test.ts`

**Interfaces:**
- Consumes: workspace TypeScript/Vitest conventions from `building-core` and `simulation-core`.
- Produces: package name `@web-three-city/rci-core` and an initially narrow import boundary.

- [ ] **Step 1: Write the failing package-boundary test**

```ts
import { describe, expect, it } from 'vitest';
import * as rci from '../src/index.js';

describe('@web-three-city/rci-core public boundary', () => {
  it('exports only intentional foundation entry points', () => {
    expect(Object.keys(rci).sort()).toEqual([
      'RciContractError',
      'createDefinitionRegistry',
      'createInitialRciSnapshot',
      'createRciSnapshot',
      'decodeRciSaveV1',
      'encodeRciSaveV1',
      'validateRciSnapshot',
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
pnpm --filter @web-three-city/rci-core test -- package-boundary.test.ts
```

Expected result: package is not discoverable or exports are missing.

- [ ] **Step 3: Add package configuration matching existing core packages**

`package.json` must contain:

```json
{
  "name": "@web-three-city/rci-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "dependencies": {
    "@web-three-city/building-core": "workspace:*",
    "@web-three-city/simulation-core": "workspace:*",
    "@web-three-city/world-core": "workspace:*",
    "@web-three-city/zone-core": "workspace:*"
  },
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

Use the same `tsconfig` and node Vitest patterns as `building-core`; do not change `pnpm-workspace.yaml`.

- [ ] **Step 4: Add a temporary compile-safe `src/index.ts` containing only later-defined exports**

Create the concrete modules in Tasks 2–5 before expecting the boundary test to pass. Do not export internal sorting/index helpers.

- [ ] **Step 5: Verify workspace discovery**

```bash
pnpm --filter @web-three-city/rci-core typecheck
```

Expected result after Tasks 2–5: PASS.

- [ ] **Step 6: Commit the package scaffold with the first concrete contracts from Task 2**

Commit after Task 2 passes so the branch never contains a permanently empty public package.

---

## Task 2: Define stable IDs, normalized records, and typed contract errors

**Files:**
- Create: `packages/rci-core/src/contracts/ids.ts`
- Create: `packages/rci-core/src/contracts/records.ts`
- Create: `packages/rci-core/src/contracts/errors.ts`
- Create: `packages/rci-core/test/records.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces exact type names consumed by every later PR:

```ts
export type CitizenId = string;
export type HouseholdId = string;
export type HouseholdMembershipId = string;
export type RelationshipId = string;
export type CitizenQualificationId = string;
export type DwellingUnitId = string;
export type HousingAssignmentId = string;
export type WorkplaceId = string;
export type EmploymentAssignmentId = string;
export type IncomingHouseholdRequestId = string;
export type DefinitionId = string;
```

- Produces normalized records matching the approved specification.
- Produces `RciContractError` and stable error codes.

- [ ] **Step 1: Write failing record-shape and error tests**

```ts
import { describe, expect, it } from 'vitest';
import { RciContractError, canonicalCitizenPair } from '../src/index.js';

describe('RCI foundation contracts', () => {
  it('canonicalizes undirected citizen pairs lexically', () => {
    expect(canonicalCitizenPair('citizen:12', 'citizen:2')).toEqual([
      'citizen:12',
      'citizen:2',
    ]);
  });

  it('rejects self relationships', () => {
    expect(() => canonicalCitizenPair('citizen:1', 'citizen:1')).toThrowError(
      new RciContractError('rci:invalid-relationship'),
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm missing exports**

```bash
pnpm --filter @web-three-city/rci-core test -- records.test.ts
```

- [ ] **Step 3: Implement immutable record contracts**

`records.ts` must define and export:

```ts
export interface CitizenRecord {
  readonly citizenId: CitizenId;
  readonly presence: 'resident' | 'emigrated' | 'deceased';
  readonly sexDefinitionId: string;
  readonly bornAtTick: number;
  readonly movedIntoCityAtTick: number;
  readonly movedOutOfCityAtTick: number | null;
  readonly diedAtTick: number | null;
}

export interface HouseholdRecord {
  readonly householdId: HouseholdId;
  readonly foundedAtTick: number;
  readonly dissolvedAtTick: number | null;
}

export interface HouseholdMembershipRecord {
  readonly membershipId: HouseholdMembershipId;
  readonly householdId: HouseholdId;
  readonly citizenId: CitizenId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

export type RelationshipRecord =
  | DirectionalRelationshipRecord
  | UndirectedRelationshipRecord;

export interface CitizenQualificationRecord {
  readonly citizenQualificationId: CitizenQualificationId;
  readonly citizenId: CitizenId;
  readonly qualificationDefinitionId: string;
  readonly awardedAtTick: number;
  readonly endedAtTick: number | null;
  readonly sourceDefinitionId: string;
}

export interface DwellingUnitRecord {
  readonly dwellingUnitId: DwellingUnitId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: string;
  readonly unitIndex: number;
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

export interface HousingAssignmentRecord {
  readonly housingAssignmentId: HousingAssignmentId;
  readonly householdId: HouseholdId;
  readonly dwellingUnitId: DwellingUnitId;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}

export interface WorkplaceRecord {
  readonly workplaceId: WorkplaceId;
  readonly buildingInstanceId: string;
  readonly capacityProfileDefinitionId: string;
  readonly activatedAtTick: number;
  readonly retiredAtTick: number | null;
}

export interface EmploymentAssignmentRecord {
  readonly employmentAssignmentId: EmploymentAssignmentId;
  readonly citizenId: CitizenId;
  readonly workplaceId: WorkplaceId;
  readonly positionGroupDefinitionId: string;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly endReasonDefinitionId: string | null;
}
```

Also define `IncomingHouseholdRequest`, `DisplacedHouseholdEntry`, `RciDemandState`, and `RciGrowthGateState` exactly as the spec.

- [ ] **Step 4: Implement explicit canonical comparators**

```ts
export function compareStableId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalCitizenPair(
  first: CitizenId,
  second: CitizenId,
): readonly [CitizenId, CitizenId] {
  if (first === second) throw new RciContractError('rci:invalid-relationship');
  return Object.freeze(compareStableId(first, second) < 0 ? [first, second] : [second, first]);
}
```

Do not use `localeCompare()` for simulation ordering.

- [ ] **Step 5: Implement typed errors**

Include the full approved error-code union and this class:

```ts
export class RciContractError extends Error {
  readonly code: RciContractErrorCode;

  constructor(code: RciContractErrorCode) {
    super(code);
    this.name = 'RciContractError';
    this.code = code;
  }
}
```

- [ ] **Step 6: Run focused tests and typecheck**

```bash
pnpm --filter @web-three-city/rci-core test -- records.test.ts
pnpm --filter @web-three-city/rci-core typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/rci-core
git commit -m "feat(rci): add normalized core contracts"
```

---

## Task 3: Add immutable definition registries and built-in foundation definitions

**Files:**
- Create: `packages/rci-core/src/definitions/definition-registry.ts`
- Create: `packages/rci-core/src/definitions/contracts.ts`
- Create: `packages/rci-core/src/definitions/foundation-definitions.ts`
- Create: `packages/rci-core/test/definition-registry.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface DefinitionRegistry<T extends Readonly<{ id: string }>> {
  get(id: string): T;
  has(id: string): boolean;
  values(): readonly T[];
}

export function createDefinitionRegistry<T extends Readonly<{ id: string }>>(
  definitions: readonly T[],
  validateReference?: (definition: T, has: (id: string) => boolean) => void,
): DefinitionRegistry<T>;
```

- Produces `RciDefinitionRegistries` and `createFoundationRciRegistries()` for tests and app composition.

- [ ] **Step 1: Write failing registry tests**

Cover:

```ts
it('sorts values by stable definition id');
it('rejects empty ids');
it('rejects duplicate ids');
it('returns frozen values');
it('throws rci:unknown-definition for missing get');
it('rejects dangling requirement and capacity-profile references');
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- definition-registry.test.ts
```

- [ ] **Step 3: Implement registry storage without exposing mutable maps**

The constructor copies, validates, sorts with `compareStableId`, freezes each value shallowly, stores a private `Map`, and returns a frozen facade. `values()` returns the same frozen sorted array on every call.

- [ ] **Step 4: Add built-in definitions required for Save compatibility**

PR 1 must define IDs and structural metadata for:

```text
sex.female
sex.male
relationship.parent.biological.mother
relationship.parent.biological.father
relationship.partner
qualification.entry
qualification.skilled
qualification.professional
requirement.qualification.entry
requirement.qualification.skilled
requirement.qualification.professional
```

Capacity profiles, migration archetypes, and population-rate tables may be structurally registered with empty immutable arrays in PR 1; their concrete balance content is added in the owning later PR. They must not be presented as delivered behavior in the living overview.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- definition-registry.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add validated definition registries"
```

---

## Task 4: Implement revisioned snapshots, sequences, and local/cross-domain validation

**Files:**
- Create: `packages/rci-core/src/rci-snapshot.ts`
- Create: `packages/rci-core/src/validation/local-validation.ts`
- Create: `packages/rci-core/src/validation/cross-domain-validation.ts`
- Create: `packages/rci-core/test/rci-snapshot.test.ts`
- Create: `packages/rci-core/test/rci-validation.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface RciSequenceState {
  readonly nextCitizen: number;
  readonly nextHousehold: number;
  readonly nextHouseholdMembership: number;
  readonly nextRelationship: number;
  readonly nextCitizenQualification: number;
  readonly nextHousingAssignment: number;
  readonly nextEmploymentAssignment: number;
  readonly nextIncomingRequest: number;
  readonly nextDomainEvent: number;
}

export interface RciSnapshot {
  readonly revision: number;
  readonly deterministicSeed: number;
  readonly population: PopulationSnapshot;
  readonly relationships: RelationshipSnapshot;
  readonly households: HouseholdSnapshot;
  readonly housing: HousingSnapshot;
  readonly employment: EmploymentSnapshot;
  readonly migration: MigrationSnapshot;
  readonly demand: RciDemandSnapshot;
  readonly sequences: RciSequenceState;
}

export function createInitialRciSnapshot(input: {
  readonly absoluteTick: number;
  readonly deterministicSeed: number;
}): RciSnapshot;

export function createRciSnapshot(
  input: RciSnapshot,
  context: RciValidationContext,
): RciSnapshot;
```

- Consumes `BuildingSnapshot`, `SimulationSnapshot`, and `RciDefinitionRegistries` for cross-domain checks.

- [ ] **Step 1: Write failing snapshot tests**

Tests must assert:

```ts
it('creates empty bounded snapshots at revision zero');
it('starts every next sequence at one');
it('rejects unsafe revision, tick, seed, and sequence values');
it('sorts every authoritative record array canonically');
it('does not mutate caller arrays');
it('rejects a sequence that would reuse an existing id');
```

- [ ] **Step 2: Write failing cross-domain validation tests**

Cover dangling citizen/household/building/definition references, duplicate active membership/partner/housing/employment, capacity exceedance, invalid demand range, and simulation tick incoherence.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-snapshot.test.ts rci-validation.test.ts
```

- [ ] **Step 4: Implement bounded snapshot constructors**

Each bounded context has its own revision and frozen sorted arrays. The root constructor performs local validation first, then pure cross-domain validation, and throws `RciContractError('rci:invalid-state')` only after retaining structured validation details for tests.

- [ ] **Step 5: Implement pure validation result**

```ts
export interface RciValidationResult {
  readonly valid: boolean;
  readonly errors: readonly Readonly<{
    code: RciContractErrorCode;
    entityId?: string;
    referenceId?: string;
  }>[];
}

export function validateRciSnapshot(
  rci: RciSnapshot,
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
  registries: RciDefinitionRegistries,
): RciValidationResult;
```

Errors sort by code, entity ID, then reference ID so input ordering cannot alter diagnostics.

- [ ] **Step 6: Run focused tests and permutation check**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-snapshot.test.ts rci-validation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/rci-core
git commit -m "feat(rci): add snapshots sequences and validation"
```

---

## Task 5: Implement canonical `RciSaveV1`

**Files:**
- Create: `packages/rci-core/src/persistence/serialization-v1.ts`
- Create: `packages/rci-core/test/serialization-v1.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface RciSaveV1 {
  readonly kind: 'rci-save';
  readonly schemaVersion: 1;
  readonly deterministicSeed: number;
  readonly revisions: Readonly<Record<string, number>>;
  readonly population: readonly CitizenRecord[];
  readonly relationships: readonly RelationshipRecord[];
  readonly households: readonly HouseholdRecord[];
  readonly householdMemberships: readonly HouseholdMembershipRecord[];
  readonly qualifications: readonly CitizenQualificationRecord[];
  readonly dwellings: readonly DwellingUnitRecord[];
  readonly housingAssignments: readonly HousingAssignmentRecord[];
  readonly workplaces: readonly WorkplaceRecord[];
  readonly employmentAssignments: readonly EmploymentAssignmentRecord[];
  readonly incomingRequests: readonly IncomingHouseholdRequest[];
  readonly displacedHouseholds: readonly DisplacedHouseholdEntry[];
  readonly migrationAttractionMilli: number;
  readonly demand: RciDemandState;
  readonly growthGates: RciGrowthGateState;
  readonly sequences: RciSequenceState;
}

export function encodeRciSaveV1(snapshot: RciSnapshot): RciSaveV1;

export function decodeRciSaveV1(
  input: unknown,
  context: RciValidationContext,
): Result<RciSnapshot, RciSaveError>;
```

- [ ] **Step 1: Write failing serialization tests**

Required cases:

```ts
it('round-trips an empty initial snapshot');
it('encodes all arrays in canonical stable-id order');
it('produces equal JSON for permuted equivalent snapshots');
it('rejects unknown schema and malformed primitive fields');
it('maps unknown definitions to rci-save:unknown-definition');
it('maps dangling records to structured decode errors');
it('rejects incoherent sequences');
it('does not serialize indexes or projections');
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- serialization-v1.test.ts
```

- [ ] **Step 3: Implement explicit structural decoding**

Do not cast untrusted input directly. Parse envelope fields, validate arrays and primitives, construct immutable records, then call `createRciSnapshot`. Convert failures into stable `RciSaveError` values.

- [ ] **Step 4: Add canonical JSON golden fixture inside the test**

Use a compact synthetic snapshot containing one record of each type. Assert exact `JSON.stringify(encodeRciSaveV1(snapshot))` output so ordering and field names become compatibility contracts.

- [ ] **Step 5: Run focused tests and build**

```bash
pnpm --filter @web-three-city/rci-core test -- serialization-v1.test.ts
pnpm --filter @web-three-city/rci-core build
```

- [ ] **Step 6: Commit**

```bash
git add packages/rci-core
git commit -m "feat(rci): add canonical save v1"
```

---

## Task 6: Add `WorldSaveV5` envelope and deterministic prior-save migration foundation

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/src/world-save.ts`
- Create: `apps/game/src/world-save-rci-migration.test.ts`
- Modify: existing `apps/game/src/world-save*.test.ts` files that assert schema versions or decoded shape

**Interfaces:**
- `DecodedWorldState` gains `readonly rci: RciSnapshot`.
- `WorldSaveErrorCode` gains `world-save:invalid-rci`.
- Produces:

```ts
export interface WorldSaveV5 {
  readonly kind: 'world-save';
  readonly schemaVersion: 5;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
  readonly buildings: BuildingSaveV2;
  readonly simulation: SimulationSaveV1;
  readonly rci: RciSaveV1;
}

export function encodeWorldSaveV5(
  terrain: TerrainSnapshot,
  roads: RoadSnapshot,
  zones: ZoneSnapshot,
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
  rci: RciSnapshot,
): WorldSaveV5;
```

- [ ] **Step 1: Add `@web-three-city/rci-core` to the game package and write failing tests**

Tests must cover V5 round trip and V1–V4 migration. For PR 1, prior versions initialize an empty RCI authority at the decoded simulation tick with zero demand, closed gates, empty queues, and sequences at one. Building-derived inventory is added by PRs 3 and 4.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/game test -- world-save-rci-migration.test.ts
```

- [ ] **Step 3: Extend envelope detection and schema validation to version 5**

Decode order remains Terrain → Water → Roads → Zones → Buildings → Simulation → RCI. Pass decoded Building/Simulation snapshots and foundation registries into `decodeRciSaveV1`.

- [ ] **Step 4: Implement prior-version initialization without inventing citizens**

```ts
const rci = createInitialRciSnapshot({
  absoluteTick: simulation.absoluteTick,
  deterministicSeed: 1,
});
```

The seed value must be centralized as `DEFAULT_RCI_DETERMINISTIC_SEED` in `rci-core`, documented, and covered by a golden migration test.

- [ ] **Step 5: Run game and package tests**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/game test -- world-save-rci-migration.test.ts
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/game packages/rci-core
git commit -m "feat(save): add world save v5 rci envelope"
```

---

## Task 7: Close PR 1 with public-boundary, docs, and verification evidence

**Files:**
- Modify: `packages/rci-core/src/index.ts`
- Modify: `packages/rci-core/test/package-boundary.test.ts`
- Modify: `docs/systems/rci/README.md`
- Create: `docs/systems/rci/verification/pr1-core-contracts-save-v1.md`

**Interfaces:**
- Public runtime exports are exactly:

```ts
export {
  RciContractError,
  createDefinitionRegistry,
  createInitialRciSnapshot,
  createRciSnapshot,
  decodeRciSaveV1,
  encodeRciSaveV1,
  validateRciSnapshot,
};
```

Export intentional public types explicitly. Do not use `export *` from internal folders.

- [ ] **Step 1: Make the package-boundary test pass**

Update the expected export list only for intentional values. Type-only exports are verified through a compile fixture rather than runtime keys.

- [ ] **Step 2: Add a dependency-direction guard**

Add a repository test or extend the existing boundary/provenance checker to fail when `building-core` or `simulation-core` imports `@web-three-city/rci-core`, or when `rci-core` imports DOM/Three.js modules.

- [ ] **Step 3: Update living documentation truthfully**

Set RCI status to `Partial` and state that contracts, registries, empty authority, validation, `RciSaveV1`, and the `WorldSaveV5` envelope exist, while lifecycle, occupancy, employment, demand, HUD, and runtime tick behavior remain unimplemented.

- [ ] **Step 4: Run PR verification**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/rci-core build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
```

- [ ] **Step 5: Record evidence**

The verification file records exact commit SHA, commands, pass counts, canonical-save permutation result, V1–V4 migration result, and confirmation that no runtime game behavior changed.

- [ ] **Step 6: Commit closure artifacts**

```bash
git add docs packages/rci-core apps/game
git commit -m "docs(rci): record core foundation verification"
```

## PR 1 Acceptance Gate

- `@web-three-city/rci-core` builds and has a narrow public boundary.
- Foundation records and registries are immutable and validated.
- Empty and synthetic snapshots round-trip through canonical `RciSaveV1`.
- `WorldSaveV5` can encode/decode RCI state.
- V1–V4 saves initialize deterministic empty RCI state without citizens.
- Permuted equivalent inputs produce byte-equivalent Save JSON.
- Invalid inputs return structured errors; stale/contract misuse uses typed exceptions.
- Dependency direction is enforced.
- Living documentation and verification evidence match delivered behavior.