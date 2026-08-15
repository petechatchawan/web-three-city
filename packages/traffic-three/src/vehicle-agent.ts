import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { vehicleAppearanceForTrip } from './vehicle-appearance.js';
import {
  headingRadians,
  sampleRouteEdgePosition,
  sampleSmoothTurn,
  type TrafficWorldPointQ,
} from './route-geometry.js';

export interface TrafficVehicleTurnInput {
  readonly previous: TrafficWorldPointQ;
  readonly corner: TrafficWorldPointQ;
  readonly next: TrafficWorldPointQ;
  readonly turnProgressQ: number;
}

export interface TrafficVehicleVisualInput {
  readonly tripId: string;
  readonly citizenId: string;
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
  readonly from: TrafficWorldPointQ;
  readonly to: TrafficWorldPointQ;
  readonly turn?: TrafficVehicleTurnInput | null;
}

export class TrafficVehicleAgent {
  readonly object = new Group();
  readonly #body: Mesh;
  readonly #roof: Mesh;
  #tripId: string | null = null;

  constructor() {
    this.object.name = 'traffic-vehicle-agent';
    this.#body = new Mesh(new BoxGeometry(1.6, 0.55, 3.2), new MeshStandardMaterial());
    this.#body.position.y = 0.42;
    this.#roof = new Mesh(new BoxGeometry(1.35, 0.5, 1.55), new MeshStandardMaterial());
    this.#roof.position.set(0, 0.88, -0.15);
    this.object.add(this.#body, this.#roof);
    this.object.visible = false;
  }

  get tripId(): string | null {
    return this.#tripId;
  }

  assign(input: TrafficVehicleVisualInput): void {
    const appearance = vehicleAppearanceForTrip(input.tripId, input.citizenId);
    (this.#body.material as MeshStandardMaterial).color.setHex(appearance.bodyColor);
    (this.#roof.material as MeshStandardMaterial).color.setHex(0x9da9b0);
    const scale = appearance.bodyVariant === 0 ? 0.92 : appearance.bodyVariant === 1 ? 1 : 1.08;
    this.object.scale.set(scale, scale, scale);
    const turn = input.turn ?? null;
    const position =
      turn === null
        ? sampleRouteEdgePosition(input.from, input.to, input.progressQ)
        : sampleSmoothTurn(turn.previous, turn.corner, turn.next, turn.turnProgressQ);
    this.object.position.copy(position);
    this.object.rotation.y =
      turn === null
        ? headingRadians(input.from, input.to)
        : headingRadians(turn.corner, turn.next);
    this.object.userData.trafficAgentKind = 'vehicle';
    this.object.userData.tripId = input.tripId;
    this.object.userData.citizenId = input.citizenId;
    this.object.userData.routeEdgeId = input.routeEdgeId;
    this.object.userData.trafficVisualState = input.queued ? 'Stop' : turn === null ? 'Drive' : 'Turn';
    this.#tripId = input.tripId;
    this.object.visible = true;
  }

  release(): void {
    this.object.visible = false;
    this.object.userData.trafficAgentKind = undefined;
    this.object.userData.tripId = undefined;
    this.object.userData.citizenId = undefined;
    this.object.userData.routeEdgeId = undefined;
    this.object.userData.trafficVisualState = undefined;
    this.#tripId = null;
  }

  dispose(): void {
    this.#body.geometry.dispose();
    this.#roof.geometry.dispose();
    (this.#body.material as MeshStandardMaterial).dispose();
    (this.#roof.material as MeshStandardMaterial).dispose();
  }
}
