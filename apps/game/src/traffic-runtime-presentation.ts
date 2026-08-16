import { BASIC_ROAD_DEFINITION } from '@web-three-city/road-core';
import { TRAFFIC_PROGRESS_MAX_Q } from '@web-three-city/traffic-core';
import {
  FOUNDATION_TRAFFIC_PRESENTATION_POLICY,
  TrafficPedestrianPool,
  TrafficVehiclePool,
  createTrafficVisualScalePolicy,
  prepareTrafficRoute,
  samplePreparedRouteInto,
  sampleRouteEdgePosition,
  type MutableTrafficRouteSample,
  type PreparedTrafficRoute,
  type TrafficPresentationPolicy,
} from '@web-three-city/traffic-three';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import { Vector3, type Scene } from 'three';
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

interface MutableReplayAgentView {
  tripId: string;
  citizenId: string;
  mode: 'Walk' | 'Drive';
  routeEdgeId: string;
  progressQ: number;
  queued: boolean;
  from: TrafficPresentationRouteSegment['from'];
  to: TrafficPresentationRouteSegment['to'];
  turn: null;
  routeSegments: readonly TrafficPresentationRouteSegment[];
  routeDistanceMillimeters: number;
}

interface TrafficJourneyReplay {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly segments: readonly TrafficPresentationRouteSegment[];
  readonly preparedRoute: PreparedTrafficRoute;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly position: Vector3;
  readonly sample: MutableTrafficRouteSample;
  readonly view: MutableReplayAgentView;
}

const LOGICAL_METERS_PER_GAMEPLAY_CELL = 8;
const REPLAY_MIN_DURATION_MS = 3_000;
const REPLAY_MAX_DURATION_MS = 12_000;
const WALK_REPLAY_MS_PER_SEGMENT = 520;
const DRIVE_REPLAY_MS_PER_SEGMENT = 280;
const REPLAY_HEADWAY_DELAY_MS = 120;

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

function routeKey(
  mode: 'Walk' | 'Drive',
  segments: readonly TrafficPresentationRouteSegment[],
): string {
  return `${mode}|${segments.map((segment) => segment.edgeId).join('|')}`;
}

export class TrafficRuntimePresentation {
  readonly #presentation: TrafficPresentation;
  readonly #overlay: TrafficInformationViewOverlay;
  readonly #replayPedestrians = new TrafficPedestrianPool(GAME_TRAFFIC_VISUAL_SCALE_POLICY);
  readonly #replayVehicles = new TrafficVehiclePool(GAME_TRAFFIC_VISUAL_SCALE_POLICY);
  #latestWorld: CommittedWorld | null = null;
  #snapshot: TrafficPresentationSnapshot | null = null;
  #snapshotDirty = false;
  #cameraDirty = true;
  #frameIndex = 0;
  #cameraAnchor: TrafficRuntimeCameraAnchor = Object.freeze({ x: 0, z: 0 });
  #replays: TrafficJourneyReplay[] = [];
  readonly #replayVisibleAgents: TrafficPresentationAgent[] = [];

  constructor(scene: Scene) {
    this.#presentation = new TrafficPresentation(
      scene,
      GAME_TRAFFIC_PRESENTATION_POLICY,
      GAME_TRAFFIC_VISUAL_SCALE_POLICY,
    );
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
    this.#snapshotDirty = true;
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
    const existingIds = new Set(this.#replays.map((replay) => replay.tripId));
    const routeCounts = new Map<string, number>();
    for (const replay of this.#replays) {
      const key = routeKey(replay.mode, replay.segments);
      routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
    }
    for (const receipt of receipts) {
      if (activeTripIds.has(receipt.tripId) || existingIds.has(receipt.tripId)) continue;
      const segments = createTrafficPresentationRouteSegments({
        roads,
        buildingAccess,
        mode: receipt.mode,
        routeEdgeIds: receipt.routeEdgeIds,
      });
      if (segments.length === 0) continue;
      const key = routeKey(receipt.mode, segments);
      const ordinal = routeCounts.get(key) ?? 0;
      routeCounts.set(key, ordinal + 1);
      const first = segments[0]!;
      const view: MutableReplayAgentView = {
        tripId: receipt.tripId,
        citizenId: receipt.citizenId,
        mode: receipt.mode,
        routeEdgeId: first.edgeId,
        progressQ: 0,
        queued: false,
        from: first.from,
        to: first.to,
        turn: null,
        routeSegments: segments,
        routeDistanceMillimeters: 0,
      };
      this.#replays.push({
        tripId: receipt.tripId,
        citizenId: receipt.citizenId,
        mode: receipt.mode,
        segments,
        preparedRoute: prepareTrafficRoute(segments),
        startedAtMs: timestampMs,
        durationMs: replayDuration(receipt.mode, segments.length),
        delayMs: receipt.mode === 'Drive' ? ordinal * REPLAY_HEADWAY_DELAY_MS : 0,
        position: new Vector3(),
        sample: { headingRadians: 0, segmentIndex: 0 },
        view,
      });
      existingIds.add(receipt.tripId);
    }
    this.#replays.sort((a, b) => (a.tripId < b.tripId ? -1 : a.tripId > b.tripId ? 1 : 0));
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
    this.#frameReplays(timestampMs);
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
    this.#replays.length = 0;
    this.#replayVisibleAgents.length = 0;
  }

  #frameReplays(timestampMs: number): void {
    this.#replayVisibleAgents.length = 0;
    let writeIndex = 0;
    for (const replay of this.#replays) {
      const elapsed = timestampMs - replay.startedAtMs - replay.delayMs;
      if (elapsed < 0) {
        this.#replays[writeIndex] = replay;
        writeIndex += 1;
        continue;
      }
      if (elapsed >= replay.durationMs) {
        if (replay.mode === 'Walk') this.#replayPedestrians.release(replay.tripId);
        else this.#replayVehicles.release(replay.tripId);
        continue;
      }
      const progress = Math.max(0, Math.min(0.999999, elapsed / replay.durationMs));
      const routeDistance = progress * replay.preparedRoute.totalLengthMillimeters;
      samplePreparedRouteInto(replay.preparedRoute, routeDistance, replay.position, replay.sample);
      const segmentIndex = replay.sample.segmentIndex;
      const segment = replay.segments[segmentIndex]!;
      const previousEnd =
        segmentIndex === 0 ? 0 : replay.preparedRoute.cumulativeEndMillimeters[segmentIndex - 1]!;
      const segmentLength = Math.max(
        1,
        replay.preparedRoute.cumulativeEndMillimeters[segmentIndex]! - previousEnd,
      );
      const localDistance = Math.max(0, routeDistance - previousEnd);
      const progressQ = Math.max(
        0,
        Math.min(
          TRAFFIC_PROGRESS_MAX_Q,
          Math.floor((localDistance * TRAFFIC_PROGRESS_MAX_Q) / segmentLength),
        ),
      );
      replay.view.routeEdgeId = segment.edgeId;
      replay.view.progressQ = progressQ;
      replay.view.from = segment.from;
      replay.view.to = segment.to;
      replay.view.routeDistanceMillimeters = routeDistance;
      this.#replayVisibleAgents.push(replay.view);

      if (replay.mode === 'Walk') {
        let visual = this.#replayPedestrians.get(replay.tripId);
        if (visual === undefined) {
          visual = this.#replayPedestrians.acquire({
            tripId: replay.tripId,
            citizenId: replay.citizenId,
            routeEdgeId: segment.edgeId,
            progressQ,
            queued: false,
            from: segment.from,
            to: segment.to,
          });
        }
        visual.object.userData.routeEdgeId = segment.edgeId;
        visual.setVisualState(false);
        visual.setTransform(replay.position, replay.sample.headingRadians);
      } else {
        let visual = this.#replayVehicles.get(replay.tripId);
        if (visual === undefined) {
          visual = this.#replayVehicles.acquire({
            tripId: replay.tripId,
            citizenId: replay.citizenId,
            routeEdgeId: segment.edgeId,
            progressQ,
            queued: false,
            from: segment.from,
            to: segment.to,
            turn: null,
          });
        }
        visual.object.userData.routeEdgeId = segment.edgeId;
        visual.setVisualState(false, false);
        visual.setTransform(replay.position, replay.sample.headingRadians);
      }
      this.#replays[writeIndex] = replay;
      writeIndex += 1;
    }
    this.#replays.length = writeIndex;
  }
}
