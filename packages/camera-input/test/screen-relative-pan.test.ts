import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraInteractionController, OrthographicCameraRig } from '../src/index.js';

const MAP = { mapWidth: 128, mapHeight: 128, cellSize: 1 } as const;
const INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;
const BOUNDS = { minimumWorldY: -1.5, maximumWorldY: 2 } as const;

function setup(yaw: number) {
  const camera = new THREE.OrthographicCamera();
  const rig = new OrthographicCameraRig(camera, MAP);
  rig.setViewport(1000, 800, INSETS);
  rig.fitToWorld(BOUNDS);
  rig.setYawDegrees(yaw);
  rig.focus(0, 0);
  const controller = new CameraInteractionController(rig, { pick: () => null });
  return { camera, controller };
}

function projected(camera: THREE.OrthographicCamera): THREE.Vector3 {
  camera.updateMatrixWorld(true);
  return new THREE.Vector3(0, 0, 0).project(camera);
}

describe('screen-relative camera pan', () => {
  it.each([17, 45, 90, 135, 180, 225, 270, 315] as const)(
    'keeps horizontal and vertical drag direction stable at yaw %s',
    (yaw) => {
      const horizontal = setup(yaw);
      const beforeRight = projected(horizontal.camera);
      horizontal.controller.panScreen({ x: 20, y: 0 });
      const afterRight = projected(horizontal.camera);
      expect(afterRight.x).toBeGreaterThan(beforeRight.x);
      expect(afterRight.y).toBeCloseTo(beforeRight.y, 5);

      const vertical = setup(yaw);
      const beforeUp = projected(vertical.camera);
      vertical.controller.panScreen({ x: 0, y: -20 });
      const afterUp = projected(vertical.camera);
      expect(afterUp.y).toBeGreaterThan(beforeUp.y);
      expect(afterUp.x).toBeCloseTo(beforeUp.x, 5);
    },
  );
});
