import { RciContractError } from '../contracts/errors.js';
import type {
  CapacityProfileDefinition,
  DefinitionRegistry,
  ResidentialCapacityProfileDefinition,
} from '../definitions/contracts.js';

export function isResidentialCapacityProfile(
  profile: CapacityProfileDefinition,
): profile is ResidentialCapacityProfileDefinition {
  return profile.kind === 'residential';
}

export function residentialCapacityProfileForId(
  registry: DefinitionRegistry<CapacityProfileDefinition>,
  id: string,
): ResidentialCapacityProfileDefinition {
  const profile = registry.get(id);
  if (!isResidentialCapacityProfile(profile)) {
    throw new RciContractError('rci:unknown-definition');
  }
  if (
    !Number.isSafeInteger(profile.dwellingUnitCount) ||
    profile.dwellingUnitCount <= 0 ||
    !Number.isSafeInteger(profile.residentCapacityPerUnit) ||
    profile.residentCapacityPerUnit <= 0
  ) {
    throw new RciContractError('rci:unknown-definition');
  }
  return profile;
}
