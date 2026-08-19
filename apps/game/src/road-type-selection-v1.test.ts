import {
  ARTERIAL_ROAD_CODE,
  COLLECTOR_ROAD_CODE,
  createEmptyRoadSnapshot,
  type RoadPlacementEnvironment,
} from '@web-three-city/road-core';
import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoadStrokeController } from './road-stroke-controller.js';
import type { RoadToolMode } from './game-tool-mode.js';
import { mountSubToolTray } from './ui/shell/subtool-tray.js';

afterEach(() => document.body.replaceChildren());

function environment(): RoadPlacementEnvironment {
  return Object.freeze({
    terrainRevision: 1,
    waterSourceTerrainRevision: 1,
    surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile {
      return Object.freeze({
        cell: Object.freeze({ ...cell }),
        corners: Object.freeze({ nw: 1, ne: 1, sw: 1, se: 1 }),
        shape: 'flat',
        minimumLevel: 1,
        maximumLevel: 1,
        slopeAxis: null,
      });
    },
    isDry: () => true,
  });
}

describe('Road type selector v1', () => {
  it('renders Local, Collector, Arterial, and Bulldoze as compact Road actions', () => {
    const picker = mountSubToolTray(document.body, { onSelectTool: vi.fn() });

    picker.open('roads');
    expect(
      Array.from(
        picker.element.querySelectorAll<HTMLButtonElement>('[data-road-definition]'),
        (button) => [button.dataset.roadDefinition, button.textContent?.trim()],
      ),
    ).toEqual([
      ['basic-road', 'Local Street'],
      ['collector-road', 'Collector Road'],
      ['arterial-road', 'Arterial Road'],
    ]);
    expect(
      Array.from(
        picker.element.querySelectorAll<HTMLButtonElement>('[data-tool-mode]'),
        (button) => button.dataset.toolMode,
      ),
    ).toEqual(['road-build', 'road-build-collector', 'road-build-arterial', 'road-bulldoze']);
  });

  it('emits the concrete Road build action and closes the picker', () => {
    const onSelectTool = vi.fn();
    const picker = mountSubToolTray(document.body, { onSelectTool });

    picker.open('roads');
    picker.element
      .querySelector<HTMLButtonElement>('[data-road-definition="collector-road"]')!
      .click();

    expect(onSelectTool).toHaveBeenCalledWith('road-build-collector');
    expect(picker.element.hidden).toBe(true);
  });

  it('captures the selected Road build action at pointer-down for an immutable stroke', () => {
    let mode: RoadToolMode = 'road-build-collector';
    const controller = createRoadStrokeController({
      config: WORLD_CONFIG,
      getMode: () => mode,
      getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
      getEnvironment: environment,
      onPreview: () => undefined,
    });

    expect(controller.begin(1, { x: 6, z: 6 })).toBe(true);
    mode = 'road-build-arterial';
    const collectorPlan = controller.end(1, { x: 6, z: 6 });
    expect(collectorPlan?.proposedDefinitionCodes[6 * WORLD_CONFIG.mapWidth + 6]).toBe(
      COLLECTOR_ROAD_CODE,
    );

    expect(controller.begin(2, { x: 7, z: 6 })).toBe(true);
    const arterialPlan = controller.end(2, { x: 7, z: 6 });
    expect(arterialPlan?.proposedDefinitionCodes[6 * WORLD_CONFIG.mapWidth + 7]).toBe(
      ARTERIAL_ROAD_CODE,
    );
  });
});
