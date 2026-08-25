import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Vector3,
} from 'three';
import { pedestrianAppearanceForCitizen } from './pedestrian-appearance.js';
import {
  headingRadians,
  sampleRouteEdgePosition,
  type TrafficWorldPointQ,
} from './route-geometry.js';
import {
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  type TrafficVisualScalePolicy,
} from './visual-scale-policy.js';
import type {
  TrafficInstancedRenderHandle,
  TrafficInstancedRenderSet,
} from './instanced-render-batch.js';

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
  readonly #body: Mesh | null;
  readonly #head: Mesh | null;
  readonly #scalePolicy: TrafficVisualScalePolicy;
  readonly #renderSet: TrafficInstancedRenderSet | null;
  #renderHandle: TrafficInstancedRenderHandle | null = null;
  #tripId: string | null = null;

  constructor(
    scalePolicy: TrafficVisualScalePolicy = FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
    renderSet: TrafficInstancedRenderSet | null = null,
  ) {
    this.#scalePolicy = scalePolicy;
    this.#renderSet = renderSet;
    this.object.name = 'traffic-pedestrian-agent';
    if (renderSet === null) {
      const headDiameter = scalePolicy.pedestrianWidthWorldUnits * 0.72;
      const bodyHeight = scalePolicy.pedestrianHeightWorldUnits - headDiameter;
      this.#body = new Mesh(
        new BoxGeometry(
          scalePolicy.pedestrianWidthWorldUnits,
          bodyHeight,
          scalePolicy.pedestrianDepthWorldUnits,
        ),
        new MeshStandardMaterial(),
      );
      this.#body.position.y = bodyHeight / 2;
      this.#head = new Mesh(new SphereGeometry(headDiameter / 2, 8, 6), new MeshStandardMaterial());
      this.#head.position.y = bodyHeight + headDiameter / 2;
      this.object.add(this.#body, this.#head);
    } else {
      this.#body = null;
      this.#head = null;
    }
    this.object.visible = false;
  }

  get tripId(): string | null {
    return this.#tripId;
  }

  get renderSlot(): number | null {
    return this.#renderHandle?.slot ?? null;
  }

  assign(input: TrafficPedestrianVisualInput): void {
    if (this.#tripId !== input.tripId) this.#bind(input);
    this.updateSourceState(input);
  }

  updateSourceState(input: TrafficPedestrianVisualInput): void {
    const position = sampleRouteEdgePosition(input.from, input.to, input.progressQ);
    this.setTransform(position, headingRadians(input.from, input.to));
    this.object.userData.routeEdgeId = input.routeEdgeId;
    this.setVisualState(input.queued);
  }

  setTransform(position: Vector3, heading: number): void {
    this.object.position.copy(position);
    this.object.rotation.y = heading;
    this.#syncRenderTransform();
  }

  setVisualState(queued: boolean): void {
    this.object.userData.trafficVisualState = queued ? 'Idle' : 'Walk';
  }

  release(): void {
    this.object.visible = false;
    this.#renderHandle?.release();
    this.#renderHandle = null;
    this.object.userData.trafficAgentKind = undefined;
    this.object.userData.tripId = undefined;
    this.object.userData.citizenId = undefined;
    this.object.userData.routeEdgeId = undefined;
    this.object.userData.trafficVisualState = undefined;
    this.object.userData.trafficRenderSlot = undefined;
    this.#tripId = null;
  }

  dispose(): void {
    this.#renderHandle?.release();
    this.#renderHandle = null;
    if (this.#body === null || this.#head === null) return;
    this.#body.geometry.dispose();
    this.#head.geometry.dispose();
    (this.#body.material as MeshStandardMaterial).dispose();
    (this.#head.material as MeshStandardMaterial).dispose();
  }

  #bind(input: TrafficPedestrianVisualInput): void {
    if (this.#tripId !== null) throw new Error('traffic-three:pedestrian-bind-active');
    const appearance = pedestrianAppearanceForCitizen(input.citizenId);
    if (this.#renderSet !== null) {
      this.#renderHandle = this.#renderSet.acquire((slot) => {
        this.object.userData.trafficRenderSlot = slot ?? undefined;
      });
      this.#renderHandle.setColors(appearance.clothingColor, appearance.accentColor);
    } else {
      (this.#body!.material as MeshStandardMaterial).color.setHex(appearance.clothingColor);
      (this.#head!.material as MeshStandardMaterial).color.setHex(appearance.accentColor);
    }
    const variation = this.#scalePolicy.appearanceScaleVariation;
    const scale =
      appearance.bodyVariant === 0
        ? 1 - variation
        : appearance.bodyVariant === 1
          ? 1
          : 1 + variation;
    this.object.scale.setScalar(scale);
    this.object.userData.trafficAgentKind = 'citizen';
    this.object.userData.tripId = input.tripId;
    this.object.userData.citizenId = input.citizenId;
    this.#tripId = input.tripId;
    this.object.visible = true;
    this.#syncRenderTransform();
  }

  #syncRenderTransform(): void {
    if (this.#renderHandle === null) return;
    this.object.updateMatrix();
    this.#renderHandle.update(this.object.matrix);
  }
}
