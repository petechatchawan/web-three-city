import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_DEFAULTS, OrthographicCameraRig } from '../src/index.js';

const MAP = { mapWidth: 128, mapHeight: 128, cellSize: 1 } as const;
const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;
const WORLD_BOUNDS = { minimumWorldY: -1.5, maximumWorldY: 2 } as const;

describe('OrthographicCameraRig', () => {
  it('starts with the accepted Unity-derived defaults', () => {
    const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);

    expect(CAMERA_DEFAULTS).toEqual({
      yawDegrees: 45,
      pitchDegrees: 50,
      minimumPitchDegrees: 35,
      maximumPitchDegrees: 65,
      hardMinimumPitchDegrees: 20,
      hardMaximumPitchDegrees: 80,
      minimumOrthographicSize: 18,
      maximumOrthographicSize: 170,
      framingMarginRatio: 0.08,
    });
    expect(rig.state).toMatchObject({
      targetX: 0,
      targetZ: 0,
      yawDegrees: 45,
      pitchDegrees: 50,
    });
  });

  it.each([
    [{ minimumPitchDegrees: 66, maximumPitchDegrees: 65 }, 'camera:invalid-pitch-limits'],
    [
      { minimumPitchDegrees: 10, maximumPitchDegrees: 65 },
      'camera:pitch-limit-outside-hard-envelope',
    ],
    [
      { minimumPitchDegrees: 35, maximumPitchDegrees: 90 },
      'camera:pitch-limit-outside-hard-envelope',
    ],
    [{ minimumOrthographicSize: 50, maximumOrthographicSize: 20 }, 'camera:invalid-zoom-limits'],
  ] as const)('rejects invalid limits', (overrides, code) => {
    expect(
      () => new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP, overrides),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it('normalizes continuous yaw and keeps exact quarter-turn button steps', () => {
    const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);

    rig.setYawDegrees(405);
    expect(rig.state.yawDegrees).toBe(45);

    rig.rotateLeft();
    expect(rig.state.yawDegrees).toBe(315);

    rig.rotateRight();
    rig.rotateRight();
    expect(rig.state.yawDegrees).toBe(135);
  });

  it('clamps pitch, orthographic size, and camera target through one state path', () => {
    const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);

    rig.setPitchDegrees(-1_000);
    rig.setOrthographicSize(1_000);
    rig.panWorld(1_000, -1_000);

    expect(rig.state.pitchDegrees).toBe(35);
    expect(rig.state.orthographicSize).toBe(170);
    expect(rig.state.targetX).toBe(64);
    expect(rig.state.targetZ).toBe(-64);
  });

  it('fits and resets the camera using the current usable viewport', () => {
    const camera = new THREE.OrthographicCamera();
    const rig = new OrthographicCameraRig(camera, MAP);

    rig.setViewport(1440, 900, { top: 0, right: 0, bottom: 0, left: 372 });
    rig.fitToWorld(WORLD_BOUNDS);
    const fitted = rig.fittedOrthographicSize;

    expect(fitted).toBeGreaterThan(0);
    expect(rig.usableViewportHeight).toBe(900);
    expect(rig.state.orthographicSize).toBe(fitted);

    rig.setYawDegrees(120);
    rig.setPitchDegrees(65);
    rig.panWorld(20, 20);
    rig.setOrthographicSize(fitted * 0.5);
    rig.resetToFit(WORLD_BOUNDS);

    expect(rig.state).toMatchObject({
      targetX: 0,
      targetZ: 0,
      yawDegrees: 45,
      pitchDegrees: 50,
      orthographicSize: fitted,
    });
  });

  it('preserves relative zoom while resizing to a new fitted viewport', () => {
    const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);

    rig.setViewport(1440, 900, ZERO_INSETS);
    rig.fitToWorld(WORLD_BOUNDS);
    const desktopFit = rig.fittedOrthographicSize;
    rig.setOrthographicSize(desktopFit * 0.75);

    rig.resizePreservingRelativeZoom(
      390,
      844,
      { top: 168, right: 0, bottom: 0, left: 0 },
      WORLD_BOUNDS,
    );

    expect(rig.state.orthographicSize / rig.fittedOrthographicSize).toBeCloseTo(0.75);
  });

  it('updates the orthographic frustum from the usable aspect ratio', () => {
    const camera = new THREE.OrthographicCamera();
    const rig = new OrthographicCameraRig(camera, MAP);

    rig.setViewport(1000, 600, { top: 0, right: 200, bottom: 0, left: 0 });
    rig.fitToWorld(WORLD_BOUNDS);

    expect(camera.right - camera.left).toBeCloseTo((camera.top - camera.bottom) * (800 / 600));
  });
});
