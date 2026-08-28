import * as THREE from 'three';

export interface ThreeBootstrapHandle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  dispose(): void;
}

export function createThreeBootstrap(canvas: HTMLCanvasElement): ThreeBootstrapHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 10, 10);
  canvas.dataset.threeBootstrap = 'ready';

  let disposed = false;
  return {
    scene,
    camera,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      delete canvas.dataset.threeBootstrap;
      scene.clear();
    },
  };
}
