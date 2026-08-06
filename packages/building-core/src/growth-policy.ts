export interface BuildingGrowthPolicy {
  readonly policyRevision: number;
  allowsZone(zoneDefinitionId: string): boolean;
  zoneWeightMilli(zoneDefinitionId: string): number;
}

export const OPEN_BUILDING_GROWTH_POLICY: BuildingGrowthPolicy = Object.freeze({
  policyRevision: 0,
  allowsZone: () => true,
  zoneWeightMilli: () => 1_000,
});

export function validateBuildingGrowthPolicy(policy: BuildingGrowthPolicy): void {
  if (!Number.isSafeInteger(policy.policyRevision) || policy.policyRevision < 0) {
    throw new RangeError('building-growth:invalid-policy');
  }
  for (const zoneId of ['residential', 'commercial', 'industrial']) {
    const weight = policy.zoneWeightMilli(zoneId);
    if (!Number.isSafeInteger(weight) || weight < 0 || weight > 100_000) {
      throw new RangeError('building-growth:invalid-policy');
    }
    if (!policy.allowsZone(zoneId) && weight !== 0) {
      throw new RangeError('building-growth:invalid-policy');
    }
  }
}
