import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";

export interface SceneCameraConfig {
  readonly fovDegrees: number;
  readonly nearMeters: number;
  readonly farMeters: number;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export type ScenePresentation =
  | {
      readonly available: true;
      readonly scene: Scene;
      readonly camera: PerspectiveCamera;
      render(): void;
      dispose(): void;
    }
  | {
      readonly available: false;
      render(): void;
      dispose(): void;
    };

const DEFAULT_CAMERA: SceneCameraConfig = Object.freeze({
  fovDegrees: 50,
  nearMeters: 0.1,
  farMeters: 100,
  position: [0, 0, 5] as const,
  target: [0, 0, 0] as const,
});

export function createScene(
  host: HTMLElement,
  cameraConfig: SceneCameraConfig = DEFAULT_CAMERA,
): ScenePresentation {
  try {
    const scene = new Scene();
    scene.background = new Color(0x10131a);

    const camera = new PerspectiveCamera(
      cameraConfig.fovDegrees,
      1,
      cameraConfig.nearMeters,
      cameraConfig.farMeters,
    );
    camera.position.set(...cameraConfig.position);
    camera.lookAt(new Vector3(...cameraConfig.target));

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "app-canvas";
    renderer.domElement.setAttribute(
      "aria-label",
      "Three.js presentation surface",
    );
    host.append(renderer.domElement);
    host.dataset.webgl = "available";

    const render = (): void => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    render();

    let disposed = false;
    return {
      available: true,
      scene,
      camera,
      render,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        resizeObserver.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
        delete host.dataset.webgl;
      },
    };
  } catch {
    host.dataset.webgl = "unavailable";
    let disposed = false;
    return {
      available: false,
      render(): void {},
      dispose(): void {
        if (disposed) return;
        disposed = true;
        delete host.dataset.webgl;
      },
    };
  }
}
