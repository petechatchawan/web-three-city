import { RciContractError } from '../contracts/errors.js';
import type {
  CapacityProfileDefinition,
  DefinitionRegistry,
  WorkplaceCapacityProfileDefinition,
} from '../definitions/contracts.js';

export function isWorkplaceCapacityProfile(
  profile: CapacityProfileDefinition,
): profile is WorkplaceCapacityProfileDefinition {
  return profile.kind === 'commercial' || profile.kind === 'industrial';
}

export function workplaceCapacityProfileForId(
  registry: DefinitionRegistry<CapacityProfileDefinition>,
  id: string,
): WorkplaceCapacityProfileDefinition {
  const profile = registry.get(id);
  if (!isWorkplaceCapacityProfile(profile) || profile.positionGroups.length === 0) {
    throw new RciContractError('rci:unknown-definition');
  }
  return profile;
}
