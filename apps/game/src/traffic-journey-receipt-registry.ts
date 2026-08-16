import type { RciSnapshot } from '@web-three-city/rci-core';
import {
  isTrafficJourneyDepartureReceipt,
  type TrafficJourneyDepartureReceipt,
} from './mobility-traffic-tick.js';

const RECEIPTS_BY_POPULATION = new WeakMap<object, readonly TrafficJourneyDepartureReceipt[]>();

export function rememberTrafficJourneyReceipts(
  rci: RciSnapshot,
  receipts: readonly Readonly<Record<string, unknown>>[],
): void {
  const departures = receipts
    .filter(isTrafficJourneyDepartureReceipt)
    .map((receipt) =>
      Object.freeze({
        ...receipt,
        routeEdgeIds: Object.freeze([...receipt.routeEdgeIds]),
      }),
    );
  if (departures.length === 0) return;
  RECEIPTS_BY_POPULATION.set(rci.population, Object.freeze(departures));
}

export function takeTrafficJourneyReceipts(
  rci: RciSnapshot,
): readonly TrafficJourneyDepartureReceipt[] {
  const receipts = RECEIPTS_BY_POPULATION.get(rci.population) ?? Object.freeze([]);
  RECEIPTS_BY_POPULATION.delete(rci.population);
  return receipts;
}
