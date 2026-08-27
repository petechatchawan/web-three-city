import { RciContractError } from '../contracts/errors.js';
import { compareStableId, type CitizenId } from '../contracts/ids.js';
import type { UndirectedRelationshipRecord } from '../contracts/records.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import { ReadonlyMapView } from './readonly-map.js';

export interface RelationshipCurrentStateIndex {
  readonly activePartnerByCitizenId: ReadonlyMap<CitizenId, UndirectedRelationshipRecord>;
}

export function createRelationshipCurrentStateIndex(
  snapshot: RciSnapshot,
): RelationshipCurrentStateIndex {
  const activePartnerByCitizenId = new Map<CitizenId, UndirectedRelationshipRecord>();
  const relationships = [...snapshot.relationships.relationships].sort((first, second) =>
    compareStableId(first.relationshipId, second.relationshipId),
  );

  for (const relationship of relationships) {
    if (
      relationship.orientation !== 'undirected' ||
      relationship.typeDefinitionId !== 'relationship.partner' ||
      relationship.endedAtMacroHourIndex !== null
    ) {
      continue;
    }
    for (const citizenId of relationship.participantCitizenIds) {
      if (activePartnerByCitizenId.has(citizenId)) {
        throw new RciContractError('rci:duplicate-active-partner');
      }
      activePartnerByCitizenId.set(citizenId, relationship);
    }
  }

  return Object.freeze({
    activePartnerByCitizenId: new ReadonlyMapView(activePartnerByCitizenId),
  });
}
