import { TRAFFIC_PROGRESS_MAX_Q } from '@web-three-city/traffic-core';
import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  TrafficPedestrianPool,
  TrafficVehiclePool,
  sampleRouteEdgePosition,
  type TrafficPresentationPolicy,
} from '@web-three-city/traffic-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import type { Scene } from 'three';
import type { CommittedWorld } from './application/committed-world.js';
import type { TrafficJourneyDepartureReceipt } from './mobility-traffic-tick.js';
import { TrafficInformationViewOverlay } from './traffic-information-view.js';
import { TrafficPresentation } from './traffic-presentation.js';
import type { TrafficPresentationDebugSnapshot } from './traffic-presentation-debug.js';
import {
  createTrafficPresentationRouteSegments,
  createTrafficPresentationSnapshot,
  type TrafficPresentationAgent,
  type TrafficPresentationRouteSegment,
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

interface TrafficJourneyReplay {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly segments: readonly TrafficPresentationRouteSegment[];
  readonly startedAtMs: number;
  readonly durationMs: number;
}

const LOGICAL_METERS_PER_GAMEPLAY_CELL = 8;
const REPLAY_MIN_DURATION_MS = 3_000;
const REPLAY_MAX_DURATION_MS = 12_000;
const WALK_REPLAY_MS_PER_SEGMENT = 520;
const DRIVE_REPLAY_MS_PER_SEGMENT = 280;

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

function replayDuration(mode: 'Walk' | 'Drive', segmentCount: number): number {
  const perSegment = mode === 'Walk' ? WALK_REPLAY_MS_PER_SEGMENT : DRIVE_REPLAY_MS_PER_SEGMENT;
  return Math.max(
    REPLAY_MIN_DURATION_MS,
    Math.min(REPLAY_MAX_DURATION_MS, Math.max(1, segmentCount) * perSegment),
  );
}

function replayAgentAt(
  replay: TrafficJourneyReplay,
  timestampMs: number,
): TrafficPresentationAgent | null {
  if (replay.segments.length === 0) return null;
  const elapsed = Math.max(0, timestampMs - replay.startedAtMs);
  if (elapsed >= replay.durationMs) return null;
  const normalized = Math.min(0.999999, elapsed / replay.durationMs);
  const routeProgress = normalized * replay.segments.length;
  const segmentIndex = Math.min(replay.segments.length - 1, Math.floor(routeProgress));
  const segment = replay.segments[segmentIndex]!;
  const localProgress = routeProgress - segmentIndex;
  const progressQ = Math.max(
    0,
    Math.min(TRAFFIC_PROGRESS_MAX_Q, Math.floor(localProgress * TRAFFIC_PROGRESS_MAX_Q)),
  );
  const nextSegment = replay.segments[segmentIndex + 1];
  const turn =
    replay.mode === 'Drive' && progressQ >= 850_000 && nextSegment !== undefined
      ? Object.freeze({
          previous: segment.from,
          corner: segment.to,
          next: nextSegment.to,
          turnProgressQ: Math.min(
            TRAFFIC_PROGRESS_MAX_Q,
            Math.floor(((progressQ - 850_000) * TRAFFIC_PROGRESS_MAX_Q) / 150_000),
          ),
        })
      : null;
  return Object.freeze({
    tripId: replay.tripId,
    citizenId: replay.citizenId,
    mode: replay.mode,
    routeEdgeId: segment.edgeId,
    progressQ,
    queued: false,
    from: segment.from,
    to: segment.to,
    turn,
  });
}

export class TrafficRuntimePresentation {
  readonly #presentation: TrafficPresentation;
  readonly #overlay: TrafficInformationViewOverlay;
  readonly #replayPedestrians = new TrafficPedestrianPool();
  readonly #replayVehicles = new TrafficVehiclePool();
  #latestWorld: CommittedWorld | null = null;
  #snapshot: TrafficPresentationSnapshot | null = null;
  #frameIndex = 0;
  #cameraAnchor: TrafficRuntimeCameraAnchor = Object.freeze({ x: 0, z: 0 });
  #replays: readonly TrafficJourneyReplay[] = Object.freeze([]);
  #replayVisibleAgents: readonly TrafficPresentationAgent[] = Object.freeze([]);

  constructor(scene: Scene) {
    this.#presentation = new TrafficPresentation(scene, GAME_TRAFFIC_PRESENTATION_POLICY);
    this.#overlay = new TrafficInformationViewOverlay(scene);
    this.#replayPedestrians.root.name = 'traffic-journey-replay-pedestrian-root';
    this.#replayVehicles.root.name = 'traffic-journey-replay-vehicle-root';
    scene.add(this.#replayPedestrians.root, this.#replayVehicles.root);
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

  enqueueJourneyReceipts(
    world: CommittedWorld,
    receipts: readonly TrafficJourneyDepartureReceipt[],
    timestampMs = performance.now(),
  ): void {
    if (receipts.length === 0) return;
    const roads = createRoadTrafficSourceProjectionFromEnvironment(
      world.roads,
      world.environments.building,
    );
    const buildingAccess = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );
    const activeTripIds = new Set(
      world.traffic.activeTrips
        .filter((trip) => trip.status === 'Active')
        .map((trip) => trip.tripId),
    );
    const additions = receipts.flatMap((receipt) => {
      if (activeTripIds.has(receipt.tripId)) return [];
      const segments = createTrafficPresentationRouteSegments({
        roads,
        buildingAccess,
        mode: receipt.mode,
        routeEdgeIds: receipt.routeEdgeIds,
      });
      if (segments.length === 0) return [];
      return [
        Object.freeze({
          tripId: receipt.tripId,
          citizenId: receipt.citizenId,
          mode: receipt.mode,
          segments,
          startedAtMs: timestampMs,
          durationMs: replayDuration(receipt.mode, segments.length),
        }),
      ];
    });
    const byTrip = new Map(this.#replays.map((replay) => [replay.tripId, replay] as const));
    for (const replay of additions) byTrip.set(replay.tripId, replay);
    this.#replays = Object.freeze(
      [...byTrip.values()].sort((a, b) => (a.tripId < b.tripId ? -1 : a.tripId > b.tripId ? 1 : 0)),
    );
  }

  setCameraAnchorFromCell(cell: CellCoord): void {
    this.#cameraAnchor = cellCenter(cell);
  }

  frame(timestampMs = performance.now()): void {
    if (this.#snapshot !== null) {
      this.#presentation.update(this.#snapshot, this.#cameraAnchor, this.#frameIndex);
      this.#frameIndex += 1;
    }

    const retainedPedestrians = new Set<string>();
    const retainedVehicles = new Set<string>();
    const visible: TrafficPresentationAgent[] = [];
    const activeReplays: TrafficJourneyReplay[] = [];
    for (const replay of this.#replays) {
      const agent = replayAgentAt(replay, timestampMs);
      if (agent === null) continue;
      activeReplays.push(replay);
      visible.push(agent);
      if (agent.mode === 'Walk') {
        retainedPedestrians.add(agent.tripId);
        this.#replayPedestrians.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: agent.progressQ,
          queued: false,
          from: agent.from,
          to: agent.to,
        });
      } else {
        retainedVehicles.add(agent.tripId);
        this.#replayVehicles.acquire({
          tripId: agent.tripId,
          citizenId: agent.citizenId,
          routeEdgeId: agent.routeEdgeId,
          progressQ: agent.progressQ,
          queued: false,
          from: agent.from,
          to: agent.to,
          turn: agent.turn,
        });
      }
    }
    this.#replayPedestrians.retainOnly(retainedPedestrians);
    this.#replayVehicles.retainOnly(retainedVehicles);
    this.#replays = Object.freeze(activeReplays);
    this.#replayVisibleAgents = Object.freeze(visible);
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
    for (const replay of this.#replayVisibleAgents) {
      if (!byTrip.has(replay.tripId)) byTrip.set(replay.tripId, replay);
    }
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
    const base = this.#presentation.debugSnapshot();
    const replayPedestrians = this.#replayPedestrians.activeCount;
    const replayVehicles = this.#replayVehicles.activeCount;
    return Object.freeze({
      ...base,
      visiblePedestrians: base.visiblePedestrians + replayPedestrians,
      visibleVehicles: base.visibleVehicles + replayVehicles,
      poolReuseCount:
        base.poolReuseCount + this.#replayPedestrians.reuseCount + this.#replayVehicles.reuseCount,
      journeyReplayCount: replayPedestrians + replayVehicles,
      journeyReplayPedestrians: replayPedestrians,
      journeyReplayVehicles: replayVehicles,
    });
  }

  dispose(): void {
    this.#overlay.dispose();
    this.#presentation.dispose();
    this.#replayPedestrians.root.removeFromParent();
    this.#replayVehicles.root.removeFromParent();
    this.#replayPedestrians.dispose();
    this.#replayVehicles.dispose();
    this.#snapshot = null;
    this.#latestWorld = null;
    this.#replays = Object.freeze([]);
    this.#replayVisibleAgents = Object.freeze([]);
  }
}
