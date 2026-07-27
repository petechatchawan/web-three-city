import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { OrthographicCameraRig } from '../src/orthographic-camera-rig.js';

describe('OrthographicCameraRig', () => {
  it('locks the accepted initial orientation and rotates in quarter turns', () => {
    const camera = new THREE.OrthographicCamera();
    const rig = new OrthographicCameraRig(camera, {
      mapWidth: 128,
      mapHeight: 128,
      cellSize: 1,
    });

    expect(rig.state).toMatchObject({
      targetX: 0,
      targetZ: 0,
      yawQuarterTurns: 0,
      pitchDegrees: 55,
      zoom: 1,
    });

    for (let index = 0; index < 4; index += 1) rig.rotateRight();
    expect(rig.state.yawQuarterTurns).toBe(0);
  });

  it('clamps zoom and camera target to the map bounds', () => {
    const camera = new THREE.OrthographicCamera();
    const rig = new OrthographicCameraRig(camera, {
      mapWidth: 128,
      mapHeight: 128,
      cellSize: 1,
    });

    rig.setZoom(100);
    rig.pan(1_000, -1_000);

    expect(rig.state.zoom).toBe(4);
    expect(rig.state.targetX).toBe(64);
    expect(rig.state.targetZ).toBe(-64);

    rig.reset();
    expect(rig.state).toMatchObject({ targetX: 0, targetZ: 0, zoom: 1 });
  });

  it('updates the orthographic frustum on resize', () => {
    const camera = new THREE.OrthographicCamera();
    const rig = new OrthographicCameraRig(camera, {
      mapWidth: 128,
      mapHeight: 128,
      cellSize: 1,
    });

    rig.resize(800, 400);

    expect(camera.right - camera.left).toBeCloseTo((camera.top - camera.bottom) * 2);
  });
});
