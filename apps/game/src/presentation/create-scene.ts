import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";

export interface ScenePresentation {
  readonly available: boolean;
  dispose(): void;
}

export function createScene(host: HTMLElement): ScenePresentation {
  try {
    const scene = new Scene();
    scene.background = new Color(0x10131a);

    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

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

    return {
      available: true,
      dispose(): void {
        resizeObserver.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
      },
    };
  } catch {
    host.dataset.webgl = "unavailable";
    return {
      available: false,
      dispose(): void {
        delete host.dataset.webgl;
      },
    };
  }
}
