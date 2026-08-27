import { RciContractError } from '../contracts/errors.js';
import { compareStableId, type CitizenId, type HouseholdId } from '../contracts/ids.js';
import type { HouseholdMembershipRecord } from '../contracts/records.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import { ReadonlyMapView } from './readonly-map.js';

export interface HouseholdCurrentStateIndex {
  readonly activeMembershipByCitizenId: ReadonlyMap<CitizenId, HouseholdMembershipRecord>;
  readonly activeMemberIdsByHouseholdId: ReadonlyMap<HouseholdId, readonly CitizenId[]>;
}

export function createHouseholdCurrentStateIndex(
  snapshot: RciSnapshot,
): HouseholdCurrentStateIndex {
  const memberships = [...snapshot.households.memberships].sort((first, second) =>
    compareStableId(first.membershipId, second.membershipId),
  );
  const activeMembershipByCitizenId = new Map<CitizenId, HouseholdMembershipRecord>();
  const mutableMembersByHouseholdId = new Map<HouseholdId, CitizenId[]>();

  for (const membership of memberships) {
    if (membership.endedAtMacroHourIndex !== null) continue;
    if (activeMembershipByCitizenId.has(membership.citizenId)) {
      throw new RciContractError('rci:duplicate-active-membership');
    }
    activeMembershipByCitizenId.set(membership.citizenId, membership);
    const members = mutableMembersByHouseholdId.get(membership.householdId) ?? [];
    members.push(membership.citizenId);
    mutableMembersByHouseholdId.set(membership.householdId, members);
  }

  const activeMemberIdsByHouseholdId = new Map<HouseholdId, readonly CitizenId[]>();
  for (const householdId of [...mutableMembersByHouseholdId.keys()].sort(compareStableId)) {
    const members = mutableMembersByHouseholdId.get(householdId) ?? [];
    activeMemberIdsByHouseholdId.set(
      householdId,
      Object.freeze([...members].sort(compareStableId)),
    );
  }

  return Object.freeze({
    activeMembershipByCitizenId: new ReadonlyMapView(activeMembershipByCitizenId),
    activeMemberIdsByHouseholdId: new ReadonlyMapView(activeMemberIdsByHouseholdId),
  });
}
