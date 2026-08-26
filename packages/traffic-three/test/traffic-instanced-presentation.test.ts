import { Color, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  TrafficPedestrianPool,
  TrafficVehiclePool,
  pedestrianAppearanceForCitizen,
  vehicleAppearanceForTrip,
} from '../src/index.js';

function vehicleInput(index: number, positionIndex = index) {
  return {
    tripId: `drive-${index}`,
    citizenId: `citizen-drive-${index}`,
    routeEdgeId: `edge-${index}`,
    progressQ: 500_000,
    queued: false,
    from: { xQ: positionIndex * 8_000, yQ: 0, zQ: 0 },
    to: { xQ: (positionIndex + 1) * 8_000, yQ: 0, zQ: 0 },
    turn: null,
  } as const;
}

function pedestrianInput(index: number, positionIndex = index) {
  return {
    tripId: `walk-${index}`,
    citizenId: `citizen-walk-${index}`,
    routeEdgeId: `walk-edge-${index}`,
    progressQ: 500_000,
    queued: false,
    from: { xQ: positionIndex * 8_000, yQ: 0, zQ: 0 },
    to: { xQ: (positionIndex + 1) * 8_000, yQ: 0, zQ: 0 },
  } as const;
}

function batches(root: { children: readonly unknown[] }, prefix: string): InstancedMesh[] {
  return root.children.filter(
    (child): child is InstancedMesh =>
      child instanceof InstancedMesh && child.name.startsWith(prefix),
  );
}

function oneBatch(root: { children: readonly unknown[] }, prefix: string): InstancedMesh {
  const matches = batches(root, prefix);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function translation(mesh: InstancedMesh, slot: number): readonly [number, number, number] {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return [matrix.elements[12]!, matrix.elements[13]!, matrix.elements[14]!];
}

describe('traffic-three instanced presentation', () => {
  it('renders only active Traffic instances while retaining bounded backing capacity', () => {
    const vehicles = new TrafficVehiclePool();
    for (let index = 0; index < 50; index += 1) vehicles.acquire(vehicleInput(index));
    const vehicleBodies = batches(vehicles.root, 'traffic-vehicle-near-body-batch');
    const vehicleRoofs = batches(vehicles.root, 'traffic-vehicle-near-roof-batch');

    expect(vehicleBodies.every((mesh) => mesh.instanceMatrix.count === 600)).toBe(true);
    expect(vehicleRoofs.every((mesh) => mesh.instanceMatrix.count === 600)).toBe(true);
    expect(vehicleBodies.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(50);
    expect(vehicleRoofs.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(50);

    const pedestrians = new TrafficPedestrianPool();
    for (let index = 0; index < 10; index += 1) pedestrians.acquire(pedestrianInput(index));
    const pedestrianBodies = batches(pedestrians.root, 'traffic-pedestrian-near-body-batch');
    const pedestrianHeads = batches(pedestrians.root, 'traffic-pedestrian-near-head-batch');

    expect(pedestrianBodies.every((mesh) => mesh.instanceMatrix.count === 600)).toBe(true);
    expect(pedestrianHeads.every((mesh) => mesh.instanceMatrix.count === 600)).toBe(true);
    expect(pedestrianBodies.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(10);
    expect(pedestrianHeads.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(10);
    vehicles.dispose();
    pedestrians.dispose();
  });

  it('keeps vehicle render submissions bounded per spatial region as visible count grows', () => {
    const pool = new TrafficVehiclePool();
    for (let index = 0; index < 24; index += 1) pool.acquire(vehicleInput(index));

    const renderables = pool.root.children.filter((child) => child instanceof InstancedMesh);
    expect(renderables.length).toBeGreaterThan(2);
    expect(renderables.every((child) => child.name.includes(':region:'))).toBe(true);
    pool.dispose();
  });

  it('partitions vehicle render batches by spatial region instead of one global batch', () => {
    const pool = new TrafficVehiclePool();
    for (const index of [0, 5, 10]) pool.acquire(vehicleInput(index));

    const renderables = pool.root.children.filter((child) => child instanceof InstancedMesh);
    expect(renderables.length).toBeGreaterThan(2);
    expect(renderables.every((batch) => batch.count > 0)).toBe(true);
    pool.dispose();
  });

  it('uses one light Mid mesh per region with fixed frustum bounds', () => {
    const pool = new TrafficVehiclePool();
    pool.acquire({ ...vehicleInput(1, 0), tier: 'Mid' });

    const mid = batches(pool.root, 'traffic-vehicle-mid-batch');
    expect(mid).toHaveLength(1);
    expect(mid[0]!.count).toBe(1);
    expect(mid[0]!.material).toBeInstanceOf(MeshBasicMaterial);
    expect(mid[0]!.frustumCulled).toBe(true);
    expect(mid[0]!.boundingSphere).not.toBeNull();
    expect(mid[0]!.userData.trafficRenderTier).toBe('Mid');
    pool.dispose();
  });

  it('keeps pedestrian render submissions bounded per spatial region as visible count grows', () => {
    const pool = new TrafficPedestrianPool();
    for (let index = 0; index < 24; index += 1) pool.acquire(pedestrianInput(index));

    const renderables = pool.root.children.filter((child) => child instanceof InstancedMesh);
    expect(renderables.length).toBeGreaterThan(2);
    expect(renderables.every((child) => child.name.includes(':region:'))).toBe(true);
    pool.dispose();
  });

  it('keeps the Near pedestrian archetype within the mobile triangle budget', () => {
    const pool = new TrafficPedestrianPool();
    pool.acquire(pedestrianInput(1, 0));
    const body = oneBatch(pool.root, 'traffic-pedestrian-near-body-batch:region:0:0');
    const head = oneBatch(pool.root, 'traffic-pedestrian-near-head-batch:region:0:0');
    const triangleCount =
      (body.geometry.index?.count ?? body.geometry.getAttribute('position').count) / 3 +
      (head.geometry.index?.count ?? head.geometry.getAttribute('position').count) / 3;

    expect(triangleCount).toBeLessThanOrEqual(24);
    pool.dispose();
  });

  it('supports one bounded old/new materialization overlap during camera reconciliation', () => {
    const pool = new TrafficVehiclePool();
    for (let index = 0; index < 600; index += 1) pool.acquire(vehicleInput(index, 0));
    const body = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:0:0');

    expect(pool.createdCount).toBe(600);
    expect(pool.root.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(2);
    expect(body.count).toBe(600);
    expect(() => pool.acquire(vehicleInput(600, 0))).toThrowError(
      'traffic-three:instance-capacity-exceeded',
    );

    pool.retainOnly(new Set(Array.from({ length: 300 }, (_, index) => `drive-${index + 300}`)));

    const retainedSlots = Array.from(
      { length: 300 },
      (_, index) => pool.get(`drive-${index + 300}`)!.renderSlot,
    ).sort((first, second) => first! - second!);
    expect(pool.activeCount).toBe(300);
    expect(body.count).toBe(300);
    expect(retainedSlots).toEqual(Array.from({ length: 300 }, (_, index) => index));
    pool.dispose();
  });

  it('compacts a released vehicle hole without changing moved identity, transform, or appearance', () => {
    const pool = new TrafficVehiclePool();
    const first = pool.acquire(vehicleInput(1, 0));
    const released = pool.acquire(vehicleInput(2, 0));
    const third = pool.acquire(vehicleInput(3, 0));
    const moved = pool.acquire(vehicleInput(4, 0));
    const body = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:0:0');
    const roof = oneBatch(pool.root, 'traffic-vehicle-near-roof-batch:region:0:0');
    const beforeSlot = moved.renderSlot!;
    const beforeBodyTranslation = translation(body, beforeSlot);
    const beforeRoofTranslation = translation(roof, beforeSlot);
    const beforeBodyColor = new Color();
    const beforeRoofColor = new Color();
    body.getColorAt(beforeSlot, beforeBodyColor);
    roof.getColorAt(beforeSlot, beforeRoofColor);

    pool.release('drive-2');

    expect(body.count).toBe(3);
    expect(roof.count).toBe(3);
    expect(first.renderSlot).toBe(0);
    expect(moved.renderSlot).toBe(1);
    expect(moved.object.userData.trafficRenderSlot).toBe(1);
    expect(third.renderSlot).toBe(2);
    expect(pool.get('drive-4')).toBe(moved);
    expect(translation(body, moved.renderSlot!)).toEqual(beforeBodyTranslation);
    expect(translation(roof, moved.renderSlot!)).toEqual(beforeRoofTranslation);
    const movedBodyColor = new Color();
    const movedRoofColor = new Color();
    body.getColorAt(moved.renderSlot!, movedBodyColor);
    roof.getColorAt(moved.renderSlot!, movedRoofColor);
    expect(movedBodyColor.getHex()).toBe(beforeBodyColor.getHex());
    expect(movedRoofColor.getHex()).toBe(beforeRoofColor.getHex());

    released.setTransform(released.object.position.clone().setX(111), 0);
    expect(translation(body, moved.renderSlot!)).toEqual(beforeBodyTranslation);

    const firstBefore = translation(body, first.renderSlot!);
    moved.setTransform(moved.object.position.clone().setX(99), 0);
    const movedBody = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:3:0');
    expect(translation(movedBody, moved.renderSlot!)[0]).toBe(99);
    expect(translation(body, first.renderSlot!)).toEqual(firstBefore);
    pool.dispose();
  });

  it('preserves identity, independent transforms, and deterministic vehicle appearance per slot', () => {
    const pool = new TrafficVehiclePool();
    const first = pool.acquire(vehicleInput(1, 0));
    const second = pool.acquire({ ...vehicleInput(2, 0), progressQ: 250_000 });
    const body = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:0:0');
    const bodyColor = new Color();

    const firstSlot = first.object.userData.trafficRenderSlot as number;
    const secondSlot = second.object.userData.trafficRenderSlot as number;
    expect(Number.isInteger(firstSlot)).toBe(true);
    expect(Number.isInteger(secondSlot)).toBe(true);
    expect(firstSlot).not.toBe(secondSlot);
    expect(first.object.userData).toMatchObject({
      tripId: 'drive-1',
      citizenId: 'citizen-drive-1',
    });
    expect(second.object.userData).toMatchObject({
      tripId: 'drive-2',
      citizenId: 'citizen-drive-2',
    });

    body.getColorAt(firstSlot, bodyColor);
    expect(bodyColor.getHex()).toBe(
      vehicleAppearanceForTrip('drive-1', 'citizen-drive-1').bodyColor,
    );
    expect(translation(body, firstSlot)).not.toEqual(translation(body, secondSlot));

    const before = translation(body, secondSlot);
    second.setTransform(second.object.position.clone().setX(99), 0);
    expect(translation(body, firstSlot)).not.toEqual(translation(body, secondSlot));
    const movedBody = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:3:0');
    expect(translation(movedBody, second.renderSlot!)).not.toEqual(before);
    pool.dispose();
  });

  it('does not republish an unchanged vehicle transform to the GPU instance buffer', () => {
    const pool = new TrafficVehiclePool();
    const vehicle = pool.acquire(vehicleInput(1, 0));
    const body = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:0:0');
    const roof = oneBatch(pool.root, 'traffic-vehicle-near-roof-batch:region:0:0');
    const bodyVersion = body.instanceMatrix.version;
    const roofVersion = roof.instanceMatrix.version;

    vehicle.setTransform(vehicle.object.position.clone(), vehicle.object.rotation.y);

    expect(body.instanceMatrix.version).toBe(bodyVersion);
    expect(roof.instanceMatrix.version).toBe(roofVersion);
    pool.dispose();
  });

  it('preserves deterministic pedestrian appearance and reuses compacted capacity without leakage', () => {
    const pool = new TrafficPedestrianPool();
    const first = pool.acquire(pedestrianInput(1, 0));
    const slot = first.renderSlot!;
    const body = oneBatch(pool.root, 'traffic-pedestrian-near-body-batch:region:0:0');
    const color = new Color();
    body.getColorAt(slot, color);
    expect(color.getHex()).toBe(pedestrianAppearanceForCitizen('citizen-walk-1').clothingColor);

    pool.release('walk-1');
    expect(body.count).toBe(0);
    expect(batches(pool.root, 'traffic-pedestrian-near-head-batch:region:0:0')).toHaveLength(0);

    const reused = pool.acquire({ ...pedestrianInput(2, 0), progressQ: 750_000 });
    expect(reused.object.userData).toMatchObject({
      tripId: 'walk-2',
      citizenId: 'citizen-walk-2',
    });
    expect(reused.object.userData.trafficRenderSlot).toBe(slot);
    const reusedBody = oneBatch(pool.root, 'traffic-pedestrian-near-body-batch:region:0:0');
    expect(translation(reusedBody, slot)).not.toEqual([4, 0, 0]);
    pool.dispose();
  });

  it('owns shared traffic resources and disposes them once', () => {
    const pool = new TrafficVehiclePool();
    pool.acquire(vehicleInput(1, 0));
    const body = oneBatch(pool.root, 'traffic-vehicle-near-body-batch:region:0:0');
    const geometryDispose = vi.spyOn(body.geometry, 'dispose');
    const materialDispose = vi.spyOn(body.material as { dispose: () => void }, 'dispose');

    pool.dispose();
    pool.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});
