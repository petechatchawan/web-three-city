import type { MobilitySnapshotV1 } from '@web-three-city/citizen-mobility-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import type { TrafficSnapshotV1 } from '@web-three-city/traffic-core';

export interface MobilityTrafficStatePair {
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
}

const STATE_BY_POPULATION = new WeakMap<object, MobilityTrafficStatePair>();

export function rememberMobilityTrafficState(
  rci: RciSnapshot,
  mobility: MobilitySnapshotV1,
  traffic: TrafficSnapshotV1,
): void {
  STATE_BY_POPULATION.set(
    rci.population,
    Object.freeze({
      mobility,
      traffic,
    }),
  );
}

export function recallMobilityTrafficState(rci: RciSnapshot): MobilityTrafficStatePair | null {
  return STATE_BY_POPULATION.get(rci.population) ?? null;
}
