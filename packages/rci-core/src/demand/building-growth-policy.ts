import type { BuildingGrowthPolicy } from '@web-three-city/building-core';
import type { RciSnapshot } from '../rci-snapshot.js';

function channelForZone(
  zoneDefinitionId: string,
): 'residential' | 'commercial' | 'industrial' | null {
  return zoneDefinitionId === 'residential' ||
    zoneDefinitionId === 'commercial' ||
    zoneDefinitionId === 'industrial'
    ? zoneDefinitionId
    : null;
}

function demandFor(
  snapshot: RciSnapshot,
  channel: 'residential' | 'commercial' | 'industrial',
): number {
  return channel === 'residential'
    ? snapshot.demand.demand.residentialMilli
    : channel === 'commercial'
      ? snapshot.demand.demand.commercialMilli
      : snapshot.demand.demand.industrialMilli;
}

function gateFor(
  snapshot: RciSnapshot,
  channel: 'residential' | 'commercial' | 'industrial',
): boolean {
  return channel === 'residential'
    ? snapshot.demand.growthGates.residentialOpen
    : channel === 'commercial'
      ? snapshot.demand.growthGates.commercialOpen
      : snapshot.demand.growthGates.industrialOpen;
}

function bootstrapOpen(snapshot: RciSnapshot): boolean {
  return snapshot.demand.revision === 0;
}

export function createBuildingGrowthPolicy(snapshot: RciSnapshot): BuildingGrowthPolicy {
  return Object.freeze({
    policyRevision: snapshot.demand.revision,
    allowsZone(zoneDefinitionId: string): boolean {
      const channel = channelForZone(zoneDefinitionId);
      return channel !== null && (bootstrapOpen(snapshot) || gateFor(snapshot, channel));
    },
    zoneWeightMilli(zoneDefinitionId: string): number {
      const channel = channelForZone(zoneDefinitionId);
      if (channel === null) return 0;
      if (bootstrapOpen(snapshot)) return 1_000;
      if (!gateFor(snapshot, channel)) return 0;
      return Math.max(1_000, Math.min(100_000, demandFor(snapshot, channel)));
    },
  });
}
