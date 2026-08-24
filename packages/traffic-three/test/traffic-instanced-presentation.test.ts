import { Color, InstancedMesh, Matrix4 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  TrafficPedestrianPool,
  TrafficVehiclePool,
  pedestrianAppearanceForCitizen,
  vehicleAppearanceForTrip,
} from '../src/index.js';

function vehicleInput(index: number) {
  return {
    tripId: `drive-${index}`,
    citizenId: `citizen-drive-${index}`,
    routeEdgeId: `edge-${index}`,
    progressQ: 500_000,
    queued: false,
    from: { xQ: index * 8_000, yQ: 0, zQ: 0 },
    to: { xQ: (index + 1) * 8_000, yQ: 0, zQ: 0 },
    turn: null,
  } as const;
}

function pedestrianInput(index: number) {
  return {
    tripId: `walk-${index}`,
    citizenId: `citizen-walk-${index}`,
    routeEdgeId: `walk-edge-${index}`,
    progressQ: 500_000,
    queued: false,
    from: { xQ: index * 8_000, yQ: 0, zQ: 0 },
    to: { xQ: (index + 1) * 8_000, yQ: 0, zQ: 0 },
  } as const;
}

function batch(root: { getObjectByName(name: string): unknown }, name: string): InstancedMesh {
  const object = root.getObjectByName(name);
  expect(object).toBeInstanceOf(InstancedMesh);
  return object as InstancedMesh;
}

function translation(mesh: InstancedMesh, slot: number): readonly [number, number, number] {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return [matrix.elements[12]!, matrix.elements[13]!, matrix.elements[14]!];
}

describe('traffic-three instanced presentation', () => {
  it('keeps vehicle render submissions bounded as visible vehicle count grows', () => {
    const pool = new TrafficVehiclePool();
    for (let index = 0; index < 24; index += 1) pool.acquire(vehicleInput(index));

    const batches = pool.root.children.filter((child) => child instanceof InstancedMesh);
    expect(batches.map((child) => child.name).sort()).toEqual([
      'traffic-vehicle-body-batch',
      'traffic-vehicle-roof-batch',
    ]);
    expect(batches).toHaveLength(2);
    expect(pool.root.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(2);
    pool.dispose();
  });

  it('keeps pedestrian render submissions bounded as visible pedestrian count grows', () => {
    const pool = new TrafficPedestrianPool();
    for (let index = 0; index < 24; index += 1) pool.acquire(pedestrianInput(index));

    const batches = pool.root.children.filter((child) => child instanceof InstancedMesh);
    expect(batches.map((child) => child.name).sort()).toEqual([
      'traffic-pedestrian-body-batch',
      'traffic-pedestrian-head-batch',
    ]);
    expect(batches).toHaveLength(2);
    pool.dispose();
  });

  it('supports one bounded old/new materialization overlap during camera reconciliation', () => {
    const pool = new TrafficVehiclePool();
    for (let index = 0; index < 300; index += 1) pool.acquire(vehicleInput(index));
    for (let index = 300; index < 600; index += 1) pool.acquire(vehicleInput(index));

    expect(pool.createdCount).toBe(600);
    expect(pool.root.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(2);
    pool.dispose();
  });

  it('preserves identity, independent transforms, and deterministic vehicle appearance per slot', () => {
    const pool = new TrafficVehiclePool();
    const first = pool.acquire(vehicleInput(1));
    const second = pool.acquire({ ...vehicleInput(2), progressQ: 250_000 });
    const body = batch(pool.root, 'traffic-vehicle-body-batch');
    const bodyColor = new Color();

    const firstSlot = first.object.userData.trafficRenderSlot;
    const secondSlot = second.object.userData.trafficRenderSlot;
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
    expect(translation(body, secondSlot)).not.toEqual(before);
    pool.dispose();
  });

  it('preserves deterministic pedestrian appearance and hides/reuses a released slot without leakage', () => {
    const pool = new TrafficPedestrianPool();
    const first = pool.acquire(pedestrianInput(1));
    const slot = first.object.userData.trafficRenderSlot;
    const body = batch(pool.root, 'traffic-pedestrian-body-batch');
    const color = new Color();
    body.getColorAt(slot, color);
    expect(color.getHex()).toBe(pedestrianAppearanceForCitizen('citizen-walk-1').clothingColor);

    pool.release('walk-1');
    const hidden = new Matrix4();
    body.getMatrixAt(slot, hidden);
    expect(hidden.determinant()).toBe(0);

    const reused = pool.acquire({ ...pedestrianInput(2), progressQ: 750_000 });
    expect(reused.object.userData).toMatchObject({
      tripId: 'walk-2',
      citizenId: 'citizen-walk-2',
    });
    expect(reused.object.userData.trafficRenderSlot).toBe(slot);
    expect(translation(body, slot)).not.toEqual([4, 0, 0]);
    pool.dispose();
  });

  it('owns shared traffic resources and disposes them once', () => {
    const pool = new TrafficVehiclePool();
    pool.acquire(vehicleInput(1));
    const body = batch(pool.root, 'traffic-vehicle-body-batch');
    const geometryDispose = vi.spyOn(body.geometry, 'dispose');
    const materialDispose = vi.spyOn(body.material as { dispose: () => void }, 'dispose');

    pool.dispose();
    pool.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});
