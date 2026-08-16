import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { pedestrianAppearanceForCitizen } from './pedestrian-appearance.js';
import {
  headingRadians,
  sampleRouteEdgePosition,
  type TrafficWorldPointQ,
} from './route-geometry.js';

export interface TrafficPedestrianVisualInput {
  readonly tripId: string;
  readonly citizenId: string;
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
  readonly from: TrafficWorldPointQ;
  readonly to: TrafficWorldPointQ;
}

export class TrafficPedestrianAgent {
  readonly object = new Group();
  readonly #body: Mesh;
  readonly #head: Mesh;
  #tripId: string | null = null;

  constructor() {
    this.object.name = 'traffic-pedestrian-agent';
    this.#body = new Mesh(new BoxGeometry(0.42, 0.9, 0.3), new MeshStandardMaterial());
    this.#body.position.y = 0.55;
    this.#head = new Mesh(new SphereGeometry(0.22, 8, 6), new MeshStandardMaterial());
    this.#head.position.y = 1.2;
    this.object.add(this.#body, this.#head);
    this.object.visible = false;
  }

  get tripId(): string | null {
    return this.#tripId;
  }

  assign(input: TrafficPedestrianVisualInput): void {
    const appearance = pedestrianAppearanceForCitizen(input.citizenId);
    (this.#body.material as MeshStandardMaterial).color.setHex(appearance.clothingColor);
    (this.#head.material as MeshStandardMaterial).color.setHex(appearance.accentColor);
    this.#body.scale.setScalar(
      appearance.bodyVariant === 0 ? 0.92 : appearance.bodyVariant === 1 ? 1 : 1.08,
    );
    const position = sampleRouteEdgePosition(input.from, input.to, input.progressQ);
    this.object.position.copy(position);
    this.object.rotation.y = headingRadians(input.from, input.to);
    this.object.userData.trafficAgentKind = 'citizen';
    this.object.userData.tripId = input.tripId;
    this.object.userData.citizenId = input.citizenId;
    this.object.userData.routeEdgeId = input.routeEdgeId;
    this.object.userData.trafficVisualState = input.queued ? 'Idle' : 'Walk';
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
    this.#head.geometry.dispose();
    (this.#body.material as MeshStandardMaterial).dispose();
    (this.#head.material as MeshStandardMaterial).dispose();
  }
}
