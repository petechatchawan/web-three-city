import { BASIC_ROAD_DEFINITION } from '@web-three-city/road-core';
import {
  FOUNDATION_TRAFFIC_SPATIAL_RENDER_POLICY,
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  createTrafficVisualScalePolicy,
  sampleRouteEdgePosition,
  type TrafficPresentationPolicy,
} from '@web-three-city/traffic-three';
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
import { createBuildingTrafficAccessProjection } from './traffic-source-projection.js';
import {
  createRoadTrafficSourceProjectionProvider,
  type RoadTrafficSourceProjectionProvider,
} from './road-traffic-source-provider.js';
import {
  createTrafficModeGraphProvider,
  type TrafficModeGraphProvider,
} from './traffic-mode-graph-provider.js';
import type { InspectTarget } from './ui/inspect/inspect-target.js';

export interface TrafficRuntimeCameraAnchor {
  readonly x: number;
  readonly z: number;
}

const LOGICAL_METERS_PER_GAMEPLAY_CELL = 8;

export const GAME_TRAFFIC_PRESENTATION_POLICY: TrafficPresentationPolicy = Object.freeze({
  ...FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  nearRadiusMeters:
    FOUNDATION_TRAFFIC_PRESENTATION_POLICY.nearRadiusMeters / LOGICAL_METERS_PER_GAMEPLAY_CELL,
  midRadiusMeters:
    FOUNDATION_TRAFFIC_PRESENTATION_POLICY.midRadiusMeters / LOGICAL_METERS_PER_GAMEPLAY_CELL,
  vehicleMinimumHeadwayMillimeters: Math.round(
    FOUNDATION_TRAFFIC_PRESENTATION_POLICY.vehicleMinimumHeadwayMillimeters /
      LOGICAL_METERS_PER_GAMEPLAY_CELL,
  ),
});

export const GAME_TRAFFIC_VISUAL_SCALE_POLICY = createTrafficVisualScalePolicy(
  BASIC_ROAD_DEFINITION.width,
);

export const GAME_TRAFFIC_SPATIAL_RENDER_POLICY = Object.freeze({
  ...FOUNDATION_TRAFFIC_SPATIAL_RENDER_POLICY,
  minimumWorldY: WORLD_CONFIG.dioramaBaseY - WORLD_CONFIG.heightStep,
  maximumWorldY: WORLD_CONFIG.maxHeightLevel * WORLD_CONFIG.heightStep + WORLD_CONFIG.heightStep,
});

function cellCenter(cell: CellCoord): TrafficRuntimeCameraAnchor {
  return Object.freeze({
    x: (cell.x + 0.5) * WORLD_CONFIG.cellSize - (WORLD_CONFIG.mapWidth * WORLD_CONFIG.cellSize) / 2,
    z:
      (cell.z + 0.5) * WORLD_CONFIG.cellSize - (WORLD_CONFIG.mapHeight * WORLD_CONFIG.cellSize) / 2,
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
  readonly #roadTrafficSourceProvider: RoadTrafficSourceProjectionProvider;
  readonly #trafficModeGraphProvider: TrafficModeGraphProvider;
  #latestWorld: CommittedWorld | null = null;
  #snapshot: TrafficPresentationSnapshot | null = null;
  #snapshotDirty = false;
  #cameraDirty = true;
  #frameIndex = 0;
  #cameraAnchor: TrafficRuntimeCameraAnchor = Object.freeze({ x: 0, z: 0 });

  constructor(
    scene: Scene,
    roadTrafficSourceProvider: RoadTrafficSourceProjectionProvider = createRoadTrafficSourceProjectionProvider(),
    trafficModeGraphProvider: TrafficModeGraphProvider = createTrafficModeGraphProvider(),
  ) {
    this.#roadTrafficSourceProvider = roadTrafficSourceProvider;
    this.#trafficModeGraphProvider = trafficModeGraphProvider;
    this.#presentation = new TrafficPresentation(
      scene,
      GAME_TRAFFIC_PRESENTATION_POLICY,
      GAME_TRAFFIC_VISUAL_SCALE_POLICY,
      GAME_TRAFFIC_SPATIAL_RENDER_POLICY,
    );
    this.#overlay = new TrafficInformationViewOverlay(scene);
  }

  synchronize(world: CommittedWorld): void {
    this.#latestWorld = world;
    const roads = this.#roadTrafficSourceProvider.get(world.roads, world.environments.building);
    const trafficGraphs = this.#trafficModeGraphProvider.get(roads, world.buildings.revision);
    const buildingAccess = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );
    this.#snapshot = createTrafficPresentationSnapshot({
      traffic: world.traffic,
      roads,
      buildingAccess,
      trafficGraphs,
      includeTrafficFlow: false,
    });
    this.#snapshotDirty = true;
    if (this.#overlay.active) this.#overlay.update(world);
  }

  setCameraAnchorFromCell(cell: CellCoord): void {
    const next = cellCenter(cell);
    if (next.x === this.#cameraAnchor.x && next.z === this.#cameraAnchor.z) return;
    this.#cameraAnchor = next;
    this.#cameraDirty = true;
  }

  frame(timestampMs = performance.now()): void {
    if (this.#snapshot !== null && (this.#snapshotDirty || this.#cameraDirty)) {
      this.#presentation.reconcile(
        this.#snapshot,
        this.#cameraAnchor,
        this.#frameIndex,
        timestampMs,
      );
      this.#snapshotDirty = false;
      this.#cameraDirty = false;
    }
    this.#presentation.frame(timestampMs);
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
    const authoritative = this.#presentation.visibleAgents();
    const byTrip = new Map(authoritative.map((agent) => [agent.tripId, agent] as const));
    const matches = [...byTrip.values()]
      .map((agent) => Object.freeze({ agent, position: currentAgentPosition(agent) }))
      .filter(({ position }) => insideCell(position, cell))
      .sort((first, second) => {
        const firstDistance =
          (first.position.x - center.x) ** 2 + (first.position.z - center.z) ** 2;
        const secondDistance =
          (second.position.x - center.x) ** 2 + (second.position.z - center.z) ** 2;
        if (firstDistance !== secondDistance) return firstDistance - secondDistance;
        return first.agent.tripId < second.agent.tripId
          ? -1
          : first.agent.tripId > second.agent.tripId
            ? 1
            : 0;
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
