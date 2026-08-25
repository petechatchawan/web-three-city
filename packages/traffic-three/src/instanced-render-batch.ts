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

// Reconciliation can acquire the next camera selection before the previous
// selection is released. Keep that overlap bounded at two policy-sized sets.
const DEFAULT_INSTANCE_CAPACITY = 600;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface TrafficInstancedRenderSet {
  readonly primary: InstancedMesh;
  readonly secondary: InstancedMesh;
  acquire(onSlotChanged: (slot: number | null) => void): TrafficInstancedRenderHandle;
  dispose(): void;
}

export interface TrafficInstancedRenderHandle {
  readonly slot: number;
  update(matrix: Matrix4): void;
  setColors(primaryHex: number, secondaryHex: number): void;
  release(): void;
}

class OwnedTrafficInstancedRenderHandle implements TrafficInstancedRenderHandle {
  readonly #owner: OwnedTrafficInstancedRenderSet;
  readonly #onSlotChanged: (slot: number | null) => void;
  #slot: number | null;

  constructor(
    owner: OwnedTrafficInstancedRenderSet,
    slot: number,
    onSlotChanged: (slot: number | null) => void,
  ) {
    this.#owner = owner;
    this.#slot = slot;
    this.#onSlotChanged = onSlotChanged;
    this.#onSlotChanged(slot);
  }

  get slot(): number {
    if (this.#slot === null) throw new RangeError('traffic-three:invalid-instance-handle');
    return this.#slot;
  }

  update(matrix: Matrix4): void {
    this.#owner.update(this, matrix);
  }

  setColors(primaryHex: number, secondaryHex: number): void {
    this.#owner.setColors(this, primaryHex, secondaryHex);
  }

  release(): void {
    this.#owner.release(this);
  }

  relocate(slot: number): void {
    this.#slot = slot;
    this.#onSlotChanged(slot);
  }

  deactivate(): void {
    this.#slot = null;
    this.#onSlotChanged(null);
  }
}

class OwnedTrafficInstancedRenderSet implements TrafficInstancedRenderSet {
  readonly primary: InstancedMesh;
  readonly secondary: InstancedMesh;
  readonly #capacity: number;
  readonly #active: OwnedTrafficInstancedRenderHandle[] = [];
  readonly #matrix = new Matrix4();
  readonly #primaryColor = new Color();
  readonly #secondaryColor = new Color();
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
    this.primary.count = 0;
    this.secondary.count = 0;
  }

  acquire(onSlotChanged: (slot: number | null) => void): TrafficInstancedRenderHandle {
    this.#assertUsable();
    if (this.#active.length >= this.#capacity) {
      throw new RangeError('traffic-three:instance-capacity-exceeded');
    }
    const slot = this.#active.length;
    const handle = new OwnedTrafficInstancedRenderHandle(this, slot, onSlotChanged);
    this.#active.push(handle);
    this.primary.setMatrixAt(slot, HIDDEN_MATRIX);
    this.secondary.setMatrixAt(slot, HIDDEN_MATRIX);
    this.#publishMatrixChange();
    this.#publishCount();
    return handle;
  }

  update(handle: OwnedTrafficInstancedRenderHandle, matrix: Matrix4): void {
    const slot = this.#slotFor(handle);
    this.primary.setMatrixAt(slot, matrix);
    this.secondary.setMatrixAt(slot, matrix);
    this.#publishMatrixChange();
  }

  setColors(
    handle: OwnedTrafficInstancedRenderHandle,
    primaryHex: number,
    secondaryHex: number,
  ): void {
    const slot = this.#slotFor(handle);
    this.#primaryColor.setHex(primaryHex);
    this.#secondaryColor.setHex(secondaryHex);
    this.primary.setColorAt(slot, this.#primaryColor);
    this.secondary.setColorAt(slot, this.#secondaryColor);
    this.#publishColorChange();
  }

  release(handle: OwnedTrafficInstancedRenderHandle): void {
    const slot = this.#slotFor(handle);
    const lastSlot = this.#active.length - 1;
    const moved = this.#active[lastSlot]!;
    if (slot !== lastSlot) {
      this.#copySlot(lastSlot, slot);
      this.#active[slot] = moved;
      moved.relocate(slot);
    }
    this.#active.pop();
    handle.deactivate();
    this.#publishCount();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const handle of this.#active) handle.deactivate();
    this.#active.length = 0;
    this.primary.count = 0;
    this.secondary.count = 0;
    this.primary.geometry.dispose();
    this.secondary.geometry.dispose();
    (this.primary.material as MeshStandardMaterial).dispose();
    (this.secondary.material as MeshStandardMaterial).dispose();
  }

  #slotFor(handle: OwnedTrafficInstancedRenderHandle): number {
    this.#assertUsable();
    const slot = handle.slot;
    if (this.#active[slot] !== handle) {
      throw new RangeError('traffic-three:invalid-instance-handle');
    }
    return slot;
  }

  #copySlot(source: number, target: number): void {
    this.primary.getMatrixAt(source, this.#matrix);
    this.primary.setMatrixAt(target, this.#matrix);
    this.secondary.getMatrixAt(source, this.#matrix);
    this.secondary.setMatrixAt(target, this.#matrix);
    this.#publishMatrixChange();

    if (this.primary.instanceColor !== null) {
      this.primary.getColorAt(source, this.#primaryColor);
      this.primary.setColorAt(target, this.#primaryColor);
    }
    if (this.secondary.instanceColor !== null) {
      this.secondary.getColorAt(source, this.#secondaryColor);
      this.secondary.setColorAt(target, this.#secondaryColor);
    }
    this.#publishColorChange();
  }

  #publishCount(): void {
    this.primary.count = this.#active.length;
    this.secondary.count = this.#active.length;
  }

  #publishMatrixChange(): void {
    this.primary.instanceMatrix.needsUpdate = true;
    this.secondary.instanceMatrix.needsUpdate = true;
  }

  #publishColorChange(): void {
    if (this.primary.instanceColor !== null) this.primary.instanceColor.needsUpdate = true;
    if (this.secondary.instanceColor !== null) this.secondary.instanceColor.needsUpdate = true;
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
