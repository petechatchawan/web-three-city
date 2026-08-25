import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  Sphere,
  Vector3,
} from 'three';
import type { TrafficVisualScalePolicy } from './visual-scale-policy.js';

// Reconciliation can acquire the next camera selection before the previous
// selection is released. Keep each spatial batch bounded at two policy-sized
// sets without rendering unused instance capacity.
const DEFAULT_INSTANCE_CAPACITY = 600;
const DEFAULT_REGION_SIZE_WORLD_UNITS = 32;
const DEFAULT_MINIMUM_WORLD_Y = -32;
const DEFAULT_MAXIMUM_WORLD_Y = 32;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

export type TrafficRenderTier = 'Near' | 'Mid';

export interface TrafficSpatialRenderPolicy {
  readonly regionSizeWorldUnits: number;
  readonly regionCapacity: number;
  readonly minimumWorldY: number;
  readonly maximumWorldY: number;
}

export const FOUNDATION_TRAFFIC_SPATIAL_RENDER_POLICY: TrafficSpatialRenderPolicy = Object.freeze({
  regionSizeWorldUnits: DEFAULT_REGION_SIZE_WORLD_UNITS,
  regionCapacity: DEFAULT_INSTANCE_CAPACITY,
  minimumWorldY: DEFAULT_MINIMUM_WORLD_Y,
  maximumWorldY: DEFAULT_MAXIMUM_WORLD_Y,
});

export interface TrafficRenderDebugSnapshot {
  readonly occupiedRegionCount: number;
  readonly nearInstanceCount: number;
  readonly midInstanceCount: number;
  readonly renderableBatchCount: number;
}

export interface TrafficInstancedRenderSet {
  acquire(
    tier: TrafficRenderTier,
    onSlotChanged: (slot: number | null) => void,
  ): TrafficInstancedRenderHandle;
  attach(parent: Group): void;
  debugSnapshot(): TrafficRenderDebugSnapshot;
  dispose(): void;
}

export interface TrafficInstancedRenderHandle {
  readonly slot: number | null;
  update(matrix: Matrix4): void;
  setColors(primaryHex: number, secondaryHex: number): void;
  setTier(tier: TrafficRenderTier): void;
  release(): void;
}

interface RenderPartDefinition {
  readonly name: string;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial;
}

interface RenderTierDefinition {
  readonly primary: RenderPartDefinition;
  readonly secondary: RenderPartDefinition | null;
}

interface RegionKey {
  readonly x: number;
  readonly z: number;
}

function regionKey(region: RegionKey, tier: TrafficRenderTier): string {
  return `${tier}:${region.x}:${region.z}`;
}

function regionForMatrix(matrix: Matrix4, regionSize: number): RegionKey {
  return {
    x: Math.floor(matrix.elements[12]! / regionSize),
    z: Math.floor(matrix.elements[14]! / regionSize),
  };
}

function validatePolicy(policy: TrafficSpatialRenderPolicy): void {
  if (
    !Number.isFinite(policy.regionSizeWorldUnits) ||
    policy.regionSizeWorldUnits <= 0 ||
    !Number.isSafeInteger(policy.regionCapacity) ||
    policy.regionCapacity <= 0 ||
    !Number.isFinite(policy.minimumWorldY) ||
    !Number.isFinite(policy.maximumWorldY) ||
    policy.maximumWorldY <= policy.minimumWorldY
  ) {
    throw new RangeError('traffic-three:invalid-spatial-render-policy');
  }
}

class OwnedTrafficInstancedRenderHandle implements TrafficInstancedRenderHandle {
  readonly #owner: OwnedTrafficInstancedRenderSet;
  readonly #onSlotChanged: (slot: number | null) => void;
  readonly #matrix = new Matrix4().copy(HIDDEN_MATRIX);
  #primaryHex = 0xffffff;
  #secondaryHex = 0xffffff;
  #tier: TrafficRenderTier;
  #batch: RegionBatch | null = null;
  #slot: number | null = null;

  constructor(
    owner: OwnedTrafficInstancedRenderSet,
    tier: TrafficRenderTier,
    onSlotChanged: (slot: number | null) => void,
  ) {
    this.#owner = owner;
    this.#tier = tier;
    this.#onSlotChanged = onSlotChanged;
  }

  get slot(): number | null {
    return this.#slot;
  }

  update(matrix: Matrix4): void {
    if (this.#matrix.equals(matrix)) return;
    this.#owner.update(this, matrix);
  }

  setColors(primaryHex: number, secondaryHex: number): void {
    this.#primaryHex = primaryHex;
    this.#secondaryHex = secondaryHex;
    this.#owner.setColors(this);
  }

  setTier(tier: TrafficRenderTier): void {
    if (this.#tier === tier) return;
    this.#tier = tier;
    this.#owner.setTier(this);
  }

  release(): void {
    this.#owner.release(this);
  }

  get tier(): TrafficRenderTier {
    return this.#tier;
  }

  get matrix(): Matrix4 {
    return this.#matrix;
  }

  get primaryHex(): number {
    return this.#primaryHex;
  }

  get secondaryHex(): number {
    return this.#secondaryHex;
  }

  get batch(): RegionBatch | null {
    return this.#batch;
  }

  attach(batch: RegionBatch, slot: number): void {
    this.#batch = batch;
    this.#slot = slot;
    this.#onSlotChanged(slot);
  }

  detach(): void {
    this.#batch = null;
    this.#slot = null;
    this.#onSlotChanged(null);
  }

  copyMatrix(matrix: Matrix4): void {
    this.#matrix.copy(matrix);
  }
}

class RegionBatch {
  readonly key: string;
  readonly tier: TrafficRenderTier;
  readonly region: RegionKey;
  readonly meshes: readonly InstancedMesh[];
  readonly #capacity: number;
  readonly #active: OwnedTrafficInstancedRenderHandle[] = [];
  readonly #primaryColor = new Color();
  readonly #secondaryColor = new Color();

  constructor(input: {
    readonly key: string;
    readonly tier: TrafficRenderTier;
    readonly region: RegionKey;
    readonly definition: RenderTierDefinition;
    readonly capacity: number;
    readonly regionSize: number;
    readonly worldY: { readonly minimum: number; readonly maximum: number };
  }) {
    this.key = input.key;
    this.tier = input.tier;
    this.region = input.region;
    this.#capacity = input.capacity;
    const definitions = [input.definition.primary];
    if (input.definition.secondary !== null) definitions.push(input.definition.secondary);
    const center = new Vector3(
      (input.region.x + 0.5) * input.regionSize,
      (input.worldY.minimum + input.worldY.maximum) / 2,
      (input.region.z + 0.5) * input.regionSize,
    );
    const horizontalRadius = Math.sqrt(2) * (input.regionSize / 2);
    const verticalRadius = (input.worldY.maximum - input.worldY.minimum) / 2;
    const radius = Math.hypot(horizontalRadius, verticalRadius) + 2;
    this.meshes = Object.freeze(
      definitions.map((part) => {
        const mesh = new InstancedMesh(part.geometry, part.material, this.#capacity);
        mesh.name = `${part.name}:region:${input.region.x}:${input.region.z}`;
        mesh.count = 0;
        mesh.frustumCulled = true;
        mesh.boundingSphere = new Sphere(center.clone(), radius);
        mesh.userData.trafficRenderTier = input.tier;
        mesh.userData.trafficRegion = Object.freeze({ ...input.region });
        return mesh;
      }),
    );
  }

  get activeCount(): number {
    return this.#active.length;
  }

  acquire(handle: OwnedTrafficInstancedRenderHandle): void {
    if (this.#active.length >= this.#capacity) {
      throw new RangeError('traffic-three:instance-capacity-exceeded');
    }
    const slot = this.#active.length;
    this.#active.push(handle);
    handle.attach(this, slot);
    this.#write(handle, slot);
    this.#publishCount();
  }

  remove(handle: OwnedTrafficInstancedRenderHandle): void {
    const slot = handle.slot;
    if (slot === null || this.#active[slot] !== handle) {
      throw new RangeError('traffic-three:invalid-instance-handle');
    }
    const lastSlot = this.#active.length - 1;
    const moved = this.#active[lastSlot]!;
    if (slot !== lastSlot) {
      this.#copySlot(lastSlot, slot);
      this.#active[slot] = moved;
      moved.attach(this, slot);
    }
    this.#active.pop();
    handle.detach();
    this.#publishCount();
  }

  write(handle: OwnedTrafficInstancedRenderHandle): void {
    const slot = handle.slot;
    if (slot === null || this.#active[slot] !== handle) {
      throw new RangeError('traffic-three:invalid-instance-handle');
    }
    this.#write(handle, slot);
  }

  #write(handle: OwnedTrafficInstancedRenderHandle, slot: number): void {
    for (const mesh of this.meshes) mesh.setMatrixAt(slot, handle.matrix);
    this.#primaryColor.setHex(handle.primaryHex);
    this.meshes[0]!.setColorAt(slot, this.#primaryColor);
    if (this.meshes[1] !== undefined) {
      this.#secondaryColor.setHex(handle.secondaryHex);
      this.meshes[1].setColorAt(slot, this.#secondaryColor);
    }
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }
  }

  #copySlot(source: number, target: number): void {
    const matrix = new Matrix4();
    const color = new Color();
    for (const mesh of this.meshes) {
      mesh.getMatrixAt(source, matrix);
      mesh.setMatrixAt(target, matrix);
      if (mesh.instanceColor !== null) {
        mesh.getColorAt(source, color);
        mesh.setColorAt(target, color);
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  #publishCount(): void {
    for (const mesh of this.meshes) mesh.count = this.#active.length;
  }
}

class OwnedTrafficInstancedRenderSet implements TrafficInstancedRenderSet {
  readonly #policy: TrafficSpatialRenderPolicy;
  readonly #tiers: Readonly<Record<TrafficRenderTier, RenderTierDefinition>>;
  readonly #batches = new Map<string, RegionBatch>();
  readonly #handles = new Set<OwnedTrafficInstancedRenderHandle>();
  readonly #ownedGeometries: readonly BufferGeometry[];
  readonly #ownedMaterials: readonly MeshBasicMaterial[];
  #parent: Group | null = null;
  #disposed = false;

  constructor(
    tiers: Readonly<Record<TrafficRenderTier, RenderTierDefinition>>,
    policy: TrafficSpatialRenderPolicy,
  ) {
    validatePolicy(policy);
    this.#policy = policy;
    this.#tiers = tiers;
    const parts = Object.values(tiers).flatMap((tier) => [tier.primary, tier.secondary]);
    this.#ownedGeometries = Object.freeze([
      ...new Set(
        parts
          .filter((part): part is RenderPartDefinition => part !== null)
          .map((part) => part.geometry),
      ),
    ]);
    this.#ownedMaterials = Object.freeze([
      ...new Set(
        parts
          .filter((part): part is RenderPartDefinition => part !== null)
          .map((part) => part.material),
      ),
    ]);
  }

  acquire(
    tier: TrafficRenderTier,
    onSlotChanged: (slot: number | null) => void,
  ): TrafficInstancedRenderHandle {
    this.#assertUsable();
    const handle = new OwnedTrafficInstancedRenderHandle(this, tier, onSlotChanged);
    this.#handles.add(handle);
    return handle;
  }

  attach(parent: Group): void {
    this.#assertUsable();
    this.#parent = parent;
    for (const batch of this.#batches.values()) this.#attachBatch(batch);
  }

  update(handle: OwnedTrafficInstancedRenderHandle, matrix: Matrix4): void {
    this.#assertUsable();
    handle.copyMatrix(matrix);
    const region = regionForMatrix(matrix, this.#policy.regionSizeWorldUnits);
    const current = handle.batch;
    const targetKey = regionKey(region, handle.tier);
    if (current?.key !== targetKey) this.#move(handle, region);
    else current.write(handle);
  }

  setColors(handle: OwnedTrafficInstancedRenderHandle): void {
    this.#assertUsable();
    handle.batch?.write(handle);
  }

  setTier(handle: OwnedTrafficInstancedRenderHandle): void {
    this.#assertUsable();
    const current = handle.batch;
    if (current === null) return;
    const region = regionForMatrix(handle.matrix, this.#policy.regionSizeWorldUnits);
    if (current.tier !== handle.tier) this.#move(handle, region);
  }

  release(handle: OwnedTrafficInstancedRenderHandle): void {
    if (this.#disposed) return;
    if (handle.batch !== null) {
      const batch = handle.batch;
      batch.remove(handle);
      if (batch.activeCount === 0) this.#removeBatch(batch);
    }
    this.#handles.delete(handle);
  }

  debugSnapshot(): TrafficRenderDebugSnapshot {
    let nearInstanceCount = 0;
    let midInstanceCount = 0;
    const occupiedRegions = new Set<string>();
    for (const batch of this.#batches.values()) {
      occupiedRegions.add(`${batch.region.x}:${batch.region.z}`);
      if (batch.tier === 'Near') nearInstanceCount += batch.activeCount;
      else midInstanceCount += batch.activeCount;
    }
    return Object.freeze({
      occupiedRegionCount: occupiedRegions.size,
      nearInstanceCount,
      midInstanceCount,
      renderableBatchCount: [...this.#batches.values()].reduce(
        (count, batch) => count + batch.meshes.length,
        0,
      ),
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const handle of this.#handles) handle.detach();
    this.#handles.clear();
    for (const batch of this.#batches.values()) this.#removeBatch(batch);
    this.#batches.clear();
    for (const geometry of this.#ownedGeometries) geometry.dispose();
    for (const material of this.#ownedMaterials) material.dispose();
    this.#parent = null;
  }

  #move(handle: OwnedTrafficInstancedRenderHandle, region: RegionKey): void {
    const previous = handle.batch;
    if (previous !== null) {
      previous.remove(handle);
      if (previous.activeCount === 0) this.#removeBatch(previous);
    }
    this.#batchFor(region, handle.tier).acquire(handle);
  }

  #batchFor(region: RegionKey, tier: TrafficRenderTier): RegionBatch {
    const key = regionKey(region, tier);
    const existing = this.#batches.get(key);
    if (existing !== undefined) return existing;
    const batch = new RegionBatch({
      key,
      tier,
      region,
      definition: this.#tiers[tier],
      capacity: this.#policy.regionCapacity,
      regionSize: this.#policy.regionSizeWorldUnits,
      worldY: {
        minimum: this.#policy.minimumWorldY,
        maximum: this.#policy.maximumWorldY,
      },
    });
    this.#batches.set(key, batch);
    this.#attachBatch(batch);
    return batch;
  }

  #attachBatch(batch: RegionBatch): void {
    if (this.#parent === null) return;
    for (const mesh of batch.meshes) this.#parent.add(mesh);
  }

  #removeBatch(batch: RegionBatch): void {
    this.#batches.delete(batch.key);
    for (const mesh of batch.meshes) mesh.removeFromParent();
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('traffic-three:instanced-render-set-disposed');
  }
}

function material(name: string): MeshBasicMaterial {
  const created = new MeshBasicMaterial({ vertexColors: true });
  created.name = name;
  return created;
}

function createSet(
  tiers: Readonly<Record<TrafficRenderTier, RenderTierDefinition>>,
  policy: TrafficSpatialRenderPolicy,
): TrafficInstancedRenderSet {
  return new OwnedTrafficInstancedRenderSet(tiers, policy);
}

export function createVehicleInstancedRenderSet(
  scalePolicy: TrafficVisualScalePolicy,
  policy: TrafficSpatialRenderPolicy = FOUNDATION_TRAFFIC_SPATIAL_RENDER_POLICY,
): TrafficInstancedRenderSet {
  const sharedMaterial = material('traffic-vehicle-material-lambert');
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
  const mid = new BoxGeometry(
    scalePolicy.vehicleWidthWorldUnits,
    scalePolicy.vehicleHeightWorldUnits,
    scalePolicy.vehicleLengthWorldUnits,
  );
  mid.translate(0, scalePolicy.vehicleHeightWorldUnits / 2, 0);
  return createSet(
    {
      Near: {
        primary: {
          name: 'traffic-vehicle-near-body-batch',
          geometry: body,
          material: sharedMaterial,
        },
        secondary: {
          name: 'traffic-vehicle-near-roof-batch',
          geometry: roof,
          material: sharedMaterial,
        },
      },
      Mid: {
        primary: { name: 'traffic-vehicle-mid-batch', geometry: mid, material: sharedMaterial },
        secondary: null,
      },
    },
    policy,
  );
}

export function createPedestrianInstancedRenderSet(
  scalePolicy: TrafficVisualScalePolicy,
  policy: TrafficSpatialRenderPolicy = FOUNDATION_TRAFFIC_SPATIAL_RENDER_POLICY,
): TrafficInstancedRenderSet {
  const sharedMaterial = material('traffic-pedestrian-material-lambert');
  const headDiameter = scalePolicy.pedestrianWidthWorldUnits * 0.72;
  const bodyHeight = scalePolicy.pedestrianHeightWorldUnits - headDiameter;
  const body = new BoxGeometry(
    scalePolicy.pedestrianWidthWorldUnits,
    bodyHeight,
    scalePolicy.pedestrianDepthWorldUnits,
  );
  body.translate(0, bodyHeight / 2, 0);
  const head = new OctahedronGeometry(headDiameter / 2, 0);
  head.translate(0, bodyHeight + headDiameter / 2, 0);
  const mid = new BoxGeometry(
    scalePolicy.pedestrianWidthWorldUnits,
    scalePolicy.pedestrianHeightWorldUnits,
    scalePolicy.pedestrianDepthWorldUnits,
  );
  mid.translate(0, scalePolicy.pedestrianHeightWorldUnits / 2, 0);
  return createSet(
    {
      Near: {
        primary: {
          name: 'traffic-pedestrian-near-body-batch',
          geometry: body,
          material: sharedMaterial,
        },
        secondary: {
          name: 'traffic-pedestrian-near-head-batch',
          geometry: head,
          material: sharedMaterial,
        },
      },
      Mid: {
        primary: {
          name: 'traffic-pedestrian-mid-batch',
          geometry: mid,
          material: sharedMaterial,
        },
        secondary: null,
      },
    },
    policy,
  );
}

export function addTrafficInstancedRenderSet(
  parent: Group,
  renderSet: TrafficInstancedRenderSet,
): void {
  renderSet.attach(parent);
}
