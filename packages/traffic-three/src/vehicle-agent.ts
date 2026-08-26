import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Vector3 } from 'three';
import { vehicleAppearanceForTrip } from './vehicle-appearance.js';
import {
  headingRadians,
  sampleRouteEdgePosition,
  sampleSmoothTurn,
  type TrafficWorldPointQ,
} from './route-geometry.js';
import {
  FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY,
  type TrafficVisualScalePolicy,
} from './visual-scale-policy.js';
import type {
  TrafficInstancedRenderHandle,
  TrafficInstancedRenderSet,
  TrafficRenderTier,
} from './instanced-render-batch.js';

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
  readonly tier?: TrafficRenderTier;
}

export class TrafficVehicleAgent {
  readonly object = new Group();
  readonly #body: Mesh | null;
  readonly #roof: Mesh | null;
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
    this.object.name = 'traffic-vehicle-agent';
    if (renderSet === null) {
      const bodyHeight = scalePolicy.vehicleHeightWorldUnits * 0.55;
      const roofHeight = scalePolicy.vehicleHeightWorldUnits * 0.45;
      this.#body = new Mesh(
        new BoxGeometry(
          scalePolicy.vehicleWidthWorldUnits,
          bodyHeight,
          scalePolicy.vehicleLengthWorldUnits,
        ),
        new MeshStandardMaterial(),
      );
      this.#body.position.y = bodyHeight / 2;
      this.#roof = new Mesh(
        new BoxGeometry(
          scalePolicy.vehicleWidthWorldUnits * 0.82,
          roofHeight,
          scalePolicy.vehicleLengthWorldUnits * 0.48,
        ),
        new MeshStandardMaterial(),
      );
      this.#roof.position.set(
        0,
        bodyHeight + roofHeight / 2,
        -scalePolicy.vehicleLengthWorldUnits * 0.04,
      );
      this.object.add(this.#body, this.#roof);
    } else {
      this.#body = null;
      this.#roof = null;
    }
    this.object.visible = false;
  }

  get tripId(): string | null {
    return this.#tripId;
  }

  get renderSlot(): number | null {
    return this.#renderHandle?.slot ?? null;
  }

  assign(input: TrafficVehicleVisualInput): void {
    if (this.#tripId !== input.tripId) this.#bind(input);
    this.updateSourceState(input);
  }

  updateSourceState(input: TrafficVehicleVisualInput): void {
    if (input.tier !== undefined) this.setRenderTier(input.tier);
    const turn = input.turn ?? null;
    const position =
      turn === null
        ? sampleRouteEdgePosition(input.from, input.to, input.progressQ)
        : sampleSmoothTurn(turn.previous, turn.corner, turn.next, turn.turnProgressQ);
    this.setTransform(
      position,
      turn === null ? headingRadians(input.from, input.to) : headingRadians(turn.corner, turn.next),
    );
    this.object.userData.routeEdgeId = input.routeEdgeId;
    this.setVisualState(input.queued, turn !== null);
  }

  setTransform(position: Vector3, heading: number): void {
    this.object.position.copy(position);
    this.object.rotation.y = heading;
    this.#syncRenderTransform();
  }

  setVisualState(queued: boolean, turning: boolean): void {
    this.object.userData.trafficVisualState = queued ? 'Stop' : turning ? 'Turn' : 'Drive';
  }

  setRenderTier(tier: TrafficRenderTier): void {
    this.#renderHandle?.setTier(tier);
    this.object.userData.trafficLodTier = tier;
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
    if (this.#body === null || this.#roof === null) return;
    this.#body.geometry.dispose();
    this.#roof.geometry.dispose();
    (this.#body.material as MeshStandardMaterial).dispose();
    (this.#roof.material as MeshStandardMaterial).dispose();
  }

  #bind(input: TrafficVehicleVisualInput): void {
    if (this.#tripId !== null) throw new Error('traffic-three:vehicle-bind-active');
    const appearance = vehicleAppearanceForTrip(input.tripId, input.citizenId);
    if (this.#renderSet !== null) {
      this.#renderHandle = this.#renderSet.acquire(input.tier ?? 'Near', (slot) => {
        this.object.userData.trafficRenderSlot = slot ?? undefined;
      });
      this.#renderHandle.setColors(appearance.bodyColor, 0x9da9b0);
    } else {
      (this.#body!.material as MeshStandardMaterial).color.setHex(appearance.bodyColor);
      (this.#roof!.material as MeshStandardMaterial).color.setHex(0x9da9b0);
    }
    const variation = this.#scalePolicy.appearanceScaleVariation;
    const scale =
      appearance.bodyVariant === 0
        ? 1 - variation
        : appearance.bodyVariant === 1
          ? 1
          : 1 + variation;
    this.object.scale.setScalar(scale);
    this.object.userData.trafficAgentKind = 'vehicle';
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
