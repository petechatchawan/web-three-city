import { buildingLifecycleCounts, type BuildingSnapshot } from '@web-three-city/building-core';
import {
  deriveGameCalendarFromGameMinute,
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
  const calendar = deriveGameCalendarFromGameMinute(simulation.absoluteGameMinute);
  const counts = buildingLifecycleCounts(buildings);
  return Object.freeze({
    calendarLabel: `Y${calendar.year} M${calendar.month} ${String(calendar.hour).padStart(2, '0')}:${String(calendar.minute).padStart(2, '0')}`,
    constructionCount: counts.construction,
    activeCount: counts.active,
    totalCount: counts.total,
  });
}
