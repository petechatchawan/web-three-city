import {
  createTrafficProjection,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  type TrafficGraph,
} from '@web-three-city/traffic-core';
import {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Vector3,
  type Scene,
} from 'three';
import type { CommittedWorld } from './application/committed-world.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';

export type TrafficSeverity = 'free' | 'moderate' | 'heavy' | 'congested';

export interface TrafficInformationEdge {
  readonly edgeId: string;
  readonly congestionMilli: number;
  readonly loadRatioMilli: number;
  readonly queueDelaySeconds: number;
  readonly severity: TrafficSeverity;
  readonly from: Readonly<{ x: number; y: number; z: number }>;
  readonly to: Readonly<{ x: number; y: number; z: number }>;
}

function severityFor(congestionMilli: number, loadRatioMilli: number): TrafficSeverity {
  if (congestionMilli >= 2000 || loadRatioMilli >= 1800) return 'congested';
  if (congestionMilli >= 1000 || loadRatioMilli >= 1400) return 'heavy';
  if (congestionMilli > 0 || loadRatioMilli >= 900) return 'moderate';
  return 'free';
}

function withBuildingRevision(graph: TrafficGraph, revision: number): TrafficGraph {
  return Object.freeze({ ...graph, sourceBuildingRevision: revision });
}

export function createTrafficInformationEdges(world: CommittedWorld): readonly TrafficInformationEdge[] {
  const roads = createRoadTrafficSourceProjectionFromEnvironment(
    world.roads,
    world.environments.building,
  );
  const access = createBuildingTrafficAccessProjection(
    world.buildings,
    world.roads,
    world.environments.building,
  );
  const drive = withBuildingRevision(deriveVehicleTrafficGraph(roads), access.buildingRevision);
  const walk = withBuildingRevision(derivePedestrianTrafficGraph(roads), access.buildingRevision);
  const combined: TrafficGraph = Object.freeze({
    sourceRoadRevision: roads.roadRevision,
    sourceBuildingRevision: access.buildingRevision,
    nodes: Object.freeze([...drive.nodes, ...walk.nodes]),
    edges: Object.freeze([...drive.edges, ...walk.edges]),
  });
  const nodeById = new Map(combined.nodes.map((node) => [node.nodeId, node] as const));
  const edgeById = new Map(combined.edges.map((edge) => [edge.edgeId, edge] as const));
  const projection = createTrafficProjection({ snapshot: world.traffic, graph: combined });
  return Object.freeze(
    projection.edges
      .filter((edge) => edgeById.get(edge.edgeId)?.mode === 'Drive')
      .flatMap((edge) => {
        const graphEdge = edgeById.get(edge.edgeId);
        if (graphEdge === undefined) return [];
        const from = nodeById.get(graphEdge.fromNodeId);
        const to = nodeById.get(graphEdge.toNodeId);
        if (from === undefined || to === undefined) return [];
        return [
          Object.freeze({
            edgeId: edge.edgeId,
            congestionMilli: edge.congestionMilli,
            loadRatioMilli: edge.loadRatioMilli,
            queueDelaySeconds: edge.queueDelaySeconds,
            severity: severityFor(edge.congestionMilli, edge.loadRatioMilli),
            from: Object.freeze({ x: from.xQ / 1000, y: from.yQ / 1000 + 0.12, z: from.zQ / 1000 }),
            to: Object.freeze({ x: to.xQ / 1000, y: to.yQ / 1000 + 0.12, z: to.zQ / 1000 }),
          }),
        ];
      })
      .sort((a, b) => (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0)),
  );
}

function severityHex(severity: TrafficSeverity): number {
  return severity === 'free'
    ? 0x4da466
    : severity === 'moderate'
      ? 0xd1aa45
      : severity === 'heavy'
        ? 0xd47b3e
        : 0xc84a45;
}

export class TrafficInformationViewOverlay {
  readonly #scene: Scene;
  readonly #root = new Group();
  #active = false;

  constructor(scene: Scene) {
    this.#scene = scene;
    this.#root.name = 'traffic-information-view';
    this.#root.visible = false;
    this.#scene.add(this.#root);
  }

  get active(): boolean {
    return this.#active;
  }

  activate(world: CommittedWorld): void {
    this.#active = true;
    this.#root.visible = true;
    this.update(world);
  }

  update(world: CommittedWorld): void {
    if (!this.#active) return;
    this.#disposeChildren();
    for (const edge of createTrafficInformationEdges(world)) {
      const geometry = new BufferGeometry().setFromPoints([
        new Vector3(edge.from.x, edge.from.y, edge.from.z),
        new Vector3(edge.to.x, edge.to.y, edge.to.z),
      ]);
      const material = new LineBasicMaterial({ color: severityHex(edge.severity) });
      const line = new LineSegments(geometry, material);
      line.userData.trafficEdgeId = edge.edgeId;
      line.userData.trafficSeverity = edge.severity;
      line.userData.loadRatioMilli = edge.loadRatioMilli;
      line.userData.congestionMilli = edge.congestionMilli;
      this.#root.add(line);
    }
  }

  deactivate(): void {
    this.#active = false;
    this.#root.visible = false;
    this.#disposeChildren();
  }

  #disposeChildren(): void {
    for (const child of [...this.#root.children]) {
      if (child instanceof LineSegments) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
      child.removeFromParent();
    }
  }

  dispose(): void {
    this.deactivate();
    this.#root.removeFromParent();
  }
}
