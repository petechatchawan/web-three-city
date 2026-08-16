import { sampleRouteEdgePosition } from '@web-three-city/traffic-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import type { Scene } from 'three';
import type { CommittedWorld } from './application/committed-world.js';
import { TrafficInformationViewOverlay } from './traffic-information-view.js';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationDebugSnapshot } from './traffic-presentation-debug.js';
import {
  createTrafficPresentationSnapshot,
  type TrafficPresentationAgent,
  type TrafficPresentationSnapshot,
} from './traffic-presentation-projection.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';
import type { InspectTarget } from './ui/inspect/inspect-target.js';

export interface TrafficRuntimeCameraAnchor {
  readonly x: number;
  readonly z: number;
}

function cellCenter(cell: CellCoord): TrafficRuntimeCameraAnchor {
  return Object.freeze({
    x:
      (cell.x + 0.5) * WORLD_CONFIG.cellSize -
      (WORLD_CONFIG.mapWidth * WORLD_CONFIG.cellSize) / 2,
    z:
      (cell.z + 0.5) * WORLD_CONFIG.cellSize -
      (WORLD_CONFIG.mapHeight * WORLD_CONFIG.cellSize) / 2,
  });
}

function currentAgentPosition(agent: TrafficPresentationAgent): Readonly<{ x: number; z: number }> {
  const point = sampleRouteEdgePosition(agent.from, agent.to, agent.progressQ);
  return Object.freeze({ x: point.x, z: point.z });
}

function insideCell(position: Readonly<{ x: number; z: number }>, cell: CellCoord): boolean {
  const minimumX =
    cell.x * WORLD_CONFIG.cellSize - (WORLD_CONFIG.mapWidth * WORLD_CONFIG.cellSize) / 2;
  const minimumZ =
    cell.z * WORLD_CONFIG.cellSize - (WORLD_CONFIG.mapHeight * WORLD_CONFIG.cellSize) / 2;
  return (
    position.x >= minimumX &&
    position.x < minimumX + WORLD_CONFIG.cellSize &&
    position.z >= minimumZ &&
    position.z < minimumZ + WORLD_CONFIG.cellSize
  );
}

export class TrafficRuntimePresentation {
  readonly #presentation: TrafficPresentation;
  readonly #overlay: TrafficInformationViewOverlay;
  #latestWorld: CommittedWorld | null = null;
  #snapshot: TrafficPresentationSnapshot | null = null;
  #frameIndex = 0;
  #cameraAnchor: TrafficRuntimeCameraAnchor = Object.freeze({ x: 0, z: 0 });

  constructor(scene: Scene) {
    this.#presentation = new TrafficPresentation(scene);
    this.#overlay = new TrafficInformationViewOverlay(scene);
  }

  synchronize(world: CommittedWorld): void {
    this.#latestWorld = world;
    const roads = createRoadTrafficSourceProjectionFromEnvironment(
      world.roads,
      world.environments.building,
    );
    const buildingAccess = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );
    this.#snapshot = createTrafficPresentationSnapshot({
      traffic: world.traffic,
      roads,
      buildingAccess,
    });
    if (this.#overlay.active) this.#overlay.update(world);
  }

  setCameraAnchorFromCell(cell: CellCoord): void {
    this.#cameraAnchor = cellCenter(cell);
  }

  frame(): void {
    if (this.#snapshot === null) return;
    this.#presentation.update(this.#snapshot, this.#cameraAnchor, this.#frameIndex);
    this.#frameIndex += 1;
  }

  setTrafficInformationView(active: boolean): void {
    if (!active) {
      this.#overlay.deactivate();
      return;
    }
    if (this.#latestWorld !== null) this.#overlay.activate(this.#latestWorld);
  }

  inspectTargetAtCell(cell: CellCoord): InspectTarget | null {
    const center = cellCenter(cell);
    const matches = this.#presentation
      .visibleAgents()
      .map((agent) => Object.freeze({ agent, position: currentAgentPosition(agent) }))
      .filter(({ position }) => insideCell(position, cell))
      .sort((first, second) => {
        const firstDistance =
          (first.position.x - center.x) ** 2 + (first.position.z - center.z) ** 2;
        const secondDistance =
          (second.position.x - center.x) ** 2 + (second.position.z - center.z) ** 2;
        if (firstDistance !== secondDistance) return firstDistance - secondDistance;
        return first.agent.tripId < second.agent.tripId ? -1 : first.agent.tripId > second.agent.tripId ? 1 : 0;
      });
    const selected = matches[0]?.agent;
    if (selected === undefined) return null;
    return selected.mode === 'Drive'
      ? Object.freeze({
          kind: 'vehicle' as const,
          citizenId: selected.citizenId,
          tripId: selected.tripId,
        })
      : Object.freeze({
          kind: 'citizen' as const,
          citizenId: selected.citizenId,
          tripId: selected.tripId,
        });
  }

  debugSnapshot(): TrafficPresentationDebugSnapshot {
    return this.#presentation.debugSnapshot();
  }

  dispose(): void {
    this.#overlay.dispose();
    this.#presentation.dispose();
    this.#snapshot = null;
    this.#latestWorld = null;
  }
}
