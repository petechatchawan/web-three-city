import { RciContractError } from '../contracts/errors.js';
import { compareStableId, type CitizenId, type HouseholdId } from '../contracts/ids.js';
import type {
  HouseholdMembershipRecord,
  UndirectedRelationshipRecord,
} from '../contracts/records.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import { createHouseholdCurrentStateIndex } from './household-index.js';
import { ReadonlyMapView } from './readonly-map.js';
import { createRelationshipCurrentStateIndex } from './relationship-index.js';

export interface RciCurrentStateIndex {
  readonly activeMembershipByCitizenId: ReadonlyMap<CitizenId, HouseholdMembershipRecord>;
  readonly activeMemberIdsByHouseholdId: ReadonlyMap<HouseholdId, readonly CitizenId[]>;
  readonly activePartnerByCitizenId: ReadonlyMap<CitizenId, UndirectedRelationshipRecord>;
  readonly activeQualificationIdsByCitizenId: ReadonlyMap<CitizenId, readonly string[]>;
}

export function createRciCurrentStateIndex(snapshot: RciSnapshot): RciCurrentStateIndex {
  const household = createHouseholdCurrentStateIndex(snapshot);
  const relationship = createRelationshipCurrentStateIndex(snapshot);
  const mutableQualificationsByCitizenId = new Map<CitizenId, string[]>();
  const activeQualifications = [...snapshot.population.qualifications]
    .filter((qualification) => qualification.endedAtMacroHourIndex === null)
    .sort((first, second) =>
      compareStableId(first.citizenQualificationId, second.citizenQualificationId),
    );

  for (const qualification of activeQualifications) {
    const definitions = mutableQualificationsByCitizenId.get(qualification.citizenId) ?? [];
    if (definitions.includes(qualification.qualificationDefinitionId)) {
      throw new RciContractError('rci:invalid-state');
    }
    definitions.push(qualification.qualificationDefinitionId);
    mutableQualificationsByCitizenId.set(qualification.citizenId, definitions);
  }

  const activeQualificationIdsByCitizenId = new Map<CitizenId, readonly string[]>();
  for (const citizenId of [...mutableQualificationsByCitizenId.keys()].sort(compareStableId)) {
    activeQualificationIdsByCitizenId.set(
      citizenId,
      Object.freeze(
        [...(mutableQualificationsByCitizenId.get(citizenId) ?? [])].sort(compareStableId),
      ),
    );
  }

  return Object.freeze({
    activeMembershipByCitizenId: household.activeMembershipByCitizenId,
    activeMemberIdsByHouseholdId: household.activeMemberIdsByHouseholdId,
    activePartnerByCitizenId: relationship.activePartnerByCitizenId,
    activeQualificationIdsByCitizenId: new ReadonlyMapView(activeQualificationIdsByCitizenId),
  });
}
