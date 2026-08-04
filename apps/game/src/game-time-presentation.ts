import {
  buildingLifecycleCounts,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  deriveGameCalendar,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';

export interface GameTimePresentation {
  readonly calendarLabel: string;
  readonly constructionCount: number;
  readonly activeCount: number;
  readonly totalCount: number;
}

export function createGameTimePresentation(
  simulation: SimulationSnapshot,
  buildings: BuildingSnapshot,
): GameTimePresentation {
  const calendar = deriveGameCalendar(simulation.absoluteTick);
  const counts = buildingLifecycleCounts(buildings);
  return Object.freeze({
    calendarLabel: `Y${calendar.year} M${calendar.month} D${calendar.day} ${String(calendar.hour).padStart(2, '0')}:00`,
    constructionCount: counts.construction,
    activeCount: counts.active,
    totalCount: counts.total,
  });
}
