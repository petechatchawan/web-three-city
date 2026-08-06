# RCI PR 1 — Core Contracts and Save V1 Verification

**PR:** #26  
**Branch:** `feat/rci-core-contracts-v0-1`  
**Verified code head:** `4fde0f366aeceac1266465040eb3f852b186ca75`  
**Verification date:** 2026-08-06

## Delivered Boundary

- `@web-three-city/rci-core` package scaffold and narrow public API.
- Stable IDs, normalized authoritative records, typed contract errors.
- Immutable definition registries and foundation definitions.
- Revisioned bounded snapshots and monotonic sequences.
- Local/cross-domain validation and canonical ordering.
- `RciSaveV1` encode/decode with structured errors.
- `WorldSaveV5` and deterministic V1–V4 empty-RCI migration.

No lifecycle, housing reconciliation, Employment reconciliation, Demand calculation, HUD, or runtime RCI tick behavior is included.

## TDD Evidence

### Core contracts RED

Lean CI run `31080061804` reached TypeScript after formatting and lint, then failed because `RciContractError` and canonical relationship behavior were not implemented.

### Definition registry RED

Lean CI run `31080581777` failed on missing registry/foundation APIs after formatting and lint passed.

### Snapshot, validation, and Save RED

Lean CI run `31081262960` failed on missing snapshot, validation, and `RciSaveV1` public APIs after formatting and lint passed.

### WorldSaveV5 RED

Lean CI run `31082130873` failed only because `encodeWorldSaveV5` and `DecodedWorldState.rci` did not exist. `rci-core` typecheck already passed in that run.

## GREEN Verification

Lean CI run `31082508871`, job `92554330008`, completed successfully on exact head `4fde0f366aeceac1266465040eb3f852b186ca75`.

The required `pnpm check` pipeline passed:

- Prettier format check
- ESLint
- workspace TypeScript typecheck
- browser test typecheck
- provenance check
- all workspace unit tests, including RCI and WorldSaveV5 migration tests
- deployment tests
- all package builds

## Determinism and Persistence Coverage

- canonical stable-ID ordering,
- immutable caller inputs and snapshots,
- sequence reuse rejection,
- sorted validation diagnostics,
- unknown-definition and dangling-reference rejection,
- `RciSaveV1` round trip,
- malformed RCI fail-closed behavior,
- `WorldSaveV4` migration to empty RCI at the saved Simulation tick,
- `WorldSaveV5` RCI round trip.

## Known Deferred Work

- PR 2 adds age, population lifecycle, Relationships, Households, and qualification mutation planners.
- PR 3 adds Building-derived Dwelling inventory and housing/migration behavior.
- PR 4 adds Workplace inventory and Employment matching.
- PR 5 adds Demand and Building Growth policy.
- PR 6 completes atomic runtime integration and browser acceptance.
