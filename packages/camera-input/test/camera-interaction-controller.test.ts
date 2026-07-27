import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CameraInteractionController,
  OrthographicCameraRig,
  type ScreenPoint,
  type TerrainAnchorResolver,
  type TerrainPickResult,
} from '../src/index.js';

const MAP = { mapWidth: 128, mapHeight: 128, cellSize: 1 } as const;
const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;
const WORLD_BOUNDS = { minimumWorldY: -1.5, maximumWorldY: 2 } as const;

function pick(x: number, z: number): TerrainPickResult {
  return {
    cellX: 64,
    cellZ: 64,
    localU: 0.5,
    localV: 0.5,
    nearestVertexX: 64,
    nearestVertexZ: 64,
    worldPoint: { x, y: 1, z },
  };
}

class QueueResolver implements TerrainAnchorResolver {
  readonly #values: Array<TerrainPickResult | null> = [];

  queue(...values: Array<TerrainPickResult | null>): void {
    this.#values.push(...values);
  }

  pick(_point: ScreenPoint): TerrainPickResult | null {
    return this.#values.shift() ?? null;
  }
}

describe('CameraInteractionController', () => {
  let rig: OrthographicCameraRig;
  let resolver: QueueResolver;
  let controller: CameraInteractionController;

  beforeEach(() => {
    rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);
    rig.setViewport(1000, 800, ZERO_INSETS);
    rig.fitToWorld(WORLD_BOUNDS);
    resolver = new QueueResolver();
    controller = new CameraInteractionController(rig, resolver);
  });

  it.each([
    [45, -1, 1],
    [135, -1, -1],
    [225, 1, -1],
    [315, 1, 1],
  ] as const)('maps rightward drag relative to yaw %s', (yaw, xSign, zSign) => {
    rig.setYawDegrees(yaw);
    controller.panScreen({ x: 20, y: 0 });
    expect(Math.sign(rig.state.targetX)).toBe(xSign);
    expect(Math.sign(rig.state.targetZ)).toBe(zSign);
  });

  it('corrects target to preserve the centroid Terrain point while zooming', () => {
    resolver.queue(pick(3, 5), pick(1, 2));

    controller.zoomAt({ x: 500, y: 300 }, 0.8);

    expect(rig.state.targetX).toBeCloseTo(2);
    expect(rig.state.targetZ).toBeCloseTo(3);
  });

  it('anchors yaw and pitch through the same correction path', () => {
    resolver.queue(pick(3, 5), pick(2, 4), pick(3, 5), pick(2.5, 4.5));

    controller.rotateYawAt({ x: 500, y: 300 }, 17);
    controller.tiltPitchAt({ x: 500, y: 300 }, 4);

    expect(rig.state.yawDegrees).toBe(62);
    expect(rig.state.pitchDegrees).toBe(54);
    expect(rig.state.targetX).toBeCloseTo(1.5);
    expect(rig.state.targetZ).toBeCloseTo(1.5);
  });

  it('keeps bounded operations when Terrain picking fails', () => {
    resolver.queue(null, null, null, null);

    controller.rotateYawAt({ x: 500, y: 300 }, 17);
    controller.tiltPitchAt({ x: 500, y: 300 }, -100);

    expect(rig.state.yawDegrees).toBe(62);
    expect(rig.state.pitchDegrees).toBe(35);
  });

  it('applies the locked wheel exponent and ignores invalid scales', () => {
    const before = rig.state.orthographicSize;

    controller.zoomWheelAt({ x: 500, y: 300 }, -100);
    const expected = before / Math.exp(0.1);
    expect(rig.state.orthographicSize).toBeCloseTo(expected);

    expect(() => controller.zoomAt({ x: 500, y: 300 }, Number.NaN)).not.toThrow();
    expect(rig.state.orthographicSize).toBeCloseTo(expected);
  });

  it('delegates exact rotation steps and reset', () => {
    controller.rotateLeft();
    expect(rig.state.yawDegrees).toBe(315);
    controller.rotateRight();
    expect(rig.state.yawDegrees).toBe(45);

    rig.panWorld(10, 10);
    controller.reset(WORLD_BOUNDS);
    expect(rig.state).toMatchObject({
      targetX: 0,
      targetZ: 0,
      yawDegrees: 45,
      pitchDegrees: 50,
    });
  });
});
