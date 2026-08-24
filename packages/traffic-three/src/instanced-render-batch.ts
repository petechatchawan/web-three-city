import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
  type Group,
} from 'three';
import type { TrafficVisualScalePolicy } from './visual-scale-policy.js';

const DEFAULT_INSTANCE_CAPACITY = 300;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface TrafficInstancedRenderSet {
  readonly primary: InstancedMesh;
  readonly secondary: InstancedMesh;
  allocate(): number;
  update(slot: number, matrix: Matrix4): void;
  setColors(slot: number, primaryHex: number, secondaryHex: number): void;
  hide(slot: number): void;
  dispose(): void;
}

class OwnedTrafficInstancedRenderSet implements TrafficInstancedRenderSet {
  readonly primary: InstancedMesh;
  readonly secondary: InstancedMesh;
  readonly #capacity: number;
  readonly #allocated = new Set<number>();
  readonly #primaryColor = new Color();
  readonly #secondaryColor = new Color();
  #nextSlot = 0;
  #disposed = false;

  constructor(input: {
    readonly primary: { name: string; geometry: BoxGeometry | SphereGeometry };
    readonly secondary: { name: string; geometry: BoxGeometry | SphereGeometry };
    readonly capacity?: number;
  }) {
    this.#capacity = input.capacity ?? DEFAULT_INSTANCE_CAPACITY;
    if (!Number.isSafeInteger(this.#capacity) || this.#capacity <= 0) {
      throw new RangeError('traffic-three:invalid-instance-capacity');
    }
    this.primary = new InstancedMesh(
      input.primary.geometry,
      new MeshStandardMaterial(),
      this.#capacity,
    );
    this.secondary = new InstancedMesh(
      input.secondary.geometry,
      new MeshStandardMaterial(),
      this.#capacity,
    );
    this.primary.name = input.primary.name;
    this.secondary.name = input.secondary.name;
    for (let slot = 0; slot < this.#capacity; slot += 1) {
      this.primary.setMatrixAt(slot, HIDDEN_MATRIX);
      this.secondary.setMatrixAt(slot, HIDDEN_MATRIX);
    }
    this.primary.instanceMatrix.needsUpdate = true;
    this.secondary.instanceMatrix.needsUpdate = true;
  }

  allocate(): number {
    this.#assertUsable();
    if (this.#nextSlot >= this.#capacity) {
      throw new RangeError('traffic-three:instance-capacity-exceeded');
    }
    const slot = this.#nextSlot;
    this.#nextSlot += 1;
    this.#allocated.add(slot);
    this.hide(slot);
    return slot;
  }

  update(slot: number, matrix: Matrix4): void {
    this.#assertSlot(slot);
    this.primary.setMatrixAt(slot, matrix);
    this.secondary.setMatrixAt(slot, matrix);
    this.primary.instanceMatrix.needsUpdate = true;
    this.secondary.instanceMatrix.needsUpdate = true;
  }

  setColors(slot: number, primaryHex: number, secondaryHex: number): void {
    this.#assertSlot(slot);
    this.#primaryColor.setHex(primaryHex);
    this.#secondaryColor.setHex(secondaryHex);
    this.primary.setColorAt(slot, this.#primaryColor);
    this.secondary.setColorAt(slot, this.#secondaryColor);
    if (this.primary.instanceColor !== null) this.primary.instanceColor.needsUpdate = true;
    if (this.secondary.instanceColor !== null) this.secondary.instanceColor.needsUpdate = true;
  }

  hide(slot: number): void {
    this.#assertSlot(slot);
    this.primary.setMatrixAt(slot, HIDDEN_MATRIX);
    this.secondary.setMatrixAt(slot, HIDDEN_MATRIX);
    this.primary.instanceMatrix.needsUpdate = true;
    this.secondary.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.primary.geometry.dispose();
    this.secondary.geometry.dispose();
    (this.primary.material as MeshStandardMaterial).dispose();
    (this.secondary.material as MeshStandardMaterial).dispose();
    this.#allocated.clear();
  }

  #assertSlot(slot: number): void {
    this.#assertUsable();
    if (!this.#allocated.has(slot)) throw new RangeError('traffic-three:invalid-instance-slot');
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('traffic-three:instanced-render-set-disposed');
  }
}

function createSet(input: {
  readonly primary: { name: string; geometry: BoxGeometry | SphereGeometry };
  readonly secondary: { name: string; geometry: BoxGeometry | SphereGeometry };
  readonly capacity?: number;
}): TrafficInstancedRenderSet {
  return new OwnedTrafficInstancedRenderSet(input);
}

export function createVehicleInstancedRenderSet(
  scalePolicy: TrafficVisualScalePolicy,
): TrafficInstancedRenderSet {
  const bodyHeight = scalePolicy.vehicleHeightWorldUnits * 0.55;
  const roofHeight = scalePolicy.vehicleHeightWorldUnits * 0.45;
  const body = new BoxGeometry(
    scalePolicy.vehicleWidthWorldUnits,
    bodyHeight,
    scalePolicy.vehicleLengthWorldUnits,
  );
  body.translate(0, bodyHeight / 2, 0);
  const roof = new BoxGeometry(
    scalePolicy.vehicleWidthWorldUnits * 0.82,
    roofHeight,
    scalePolicy.vehicleLengthWorldUnits * 0.48,
  );
  roof.translate(0, bodyHeight + roofHeight / 2, -scalePolicy.vehicleLengthWorldUnits * 0.04);
  return createSet({
    primary: { name: 'traffic-vehicle-body-batch', geometry: body },
    secondary: { name: 'traffic-vehicle-roof-batch', geometry: roof },
  });
}

export function createPedestrianInstancedRenderSet(
  scalePolicy: TrafficVisualScalePolicy,
): TrafficInstancedRenderSet {
  const headDiameter = scalePolicy.pedestrianWidthWorldUnits * 0.72;
  const bodyHeight = scalePolicy.pedestrianHeightWorldUnits - headDiameter;
  const body = new BoxGeometry(
    scalePolicy.pedestrianWidthWorldUnits,
    bodyHeight,
    scalePolicy.pedestrianDepthWorldUnits,
  );
  body.translate(0, bodyHeight / 2, 0);
  const head = new SphereGeometry(headDiameter / 2, 8, 6);
  head.translate(0, bodyHeight + headDiameter / 2, 0);
  return createSet({
    primary: { name: 'traffic-pedestrian-body-batch', geometry: body },
    secondary: { name: 'traffic-pedestrian-head-batch', geometry: head },
  });
}

export function addTrafficInstancedRenderSet(
  parent: Group,
  renderSet: TrafficInstancedRenderSet,
): void {
  parent.add(renderSet.primary, renderSet.secondary);
}
