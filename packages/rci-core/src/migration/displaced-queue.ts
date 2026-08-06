import { RciContractError } from '../contracts/errors.js';
import { compareStableId, type HouseholdId } from '../contracts/ids.js';
import type { DisplacedHouseholdEntry } from '../contracts/records.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';

export function orderDisplacedHouseholds(
  entries: readonly DisplacedHouseholdEntry[],
): readonly DisplacedHouseholdEntry[] {
  return Object.freeze(
    [...entries].sort(
      (a, b) =>
        a.expiresAtTick - b.expiresAtTick ||
        a.displacedAtTick - b.displacedAtTick ||
        a.deterministicSequence - b.deterministicSequence ||
        compareStableId(a.householdId, b.householdId),
    ),
  );
}

export function planDisplaceHousehold(
  input: Readonly<{
    snapshot: RciSnapshot;
    householdId: HouseholdId;
    displacedAtTick: number;
    expiresAfterTicks?: number;
  }>,
): RciSnapshot {
  if (
    input.snapshot.migration.displacedHouseholds.some(
      (entry) => entry.householdId === input.householdId,
    )
  ) {
    return input.snapshot;
  }
  const household = input.snapshot.households.households.find(
    (value) => value.householdId === input.householdId,
  );
  if (household === undefined || household.dissolvedAtTick !== null) {
    throw new RciContractError('rci:dangling-household');
  }
  const minimumResidentCapacity = input.snapshot.households.memberships.filter(
    (membership) => membership.householdId === input.householdId && membership.endedAtTick === null,
  ).length;
  return canonicalizeRciSnapshot({
    ...input.snapshot,
    revision: input.snapshot.revision + 1,
    migration: {
      ...input.snapshot.migration,
      revision: input.snapshot.migration.revision + 1,
      displacedHouseholds: [
        ...input.snapshot.migration.displacedHouseholds,
        Object.freeze({
          householdId: input.householdId,
          displacedAtTick: input.displacedAtTick,
          expiresAtTick: input.displacedAtTick + (input.expiresAfterTicks ?? 720),
          minimumResidentCapacity: Math.max(1, minimumResidentCapacity),
          displacementPressure: 100_000,
          deterministicSequence: input.snapshot.sequences.nextDomainEvent,
        }),
      ],
    },
    sequences: {
      ...input.snapshot.sequences,
      nextDomainEvent: input.snapshot.sequences.nextDomainEvent + 1,
    },
  });
}
