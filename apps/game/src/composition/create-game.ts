import { createScene } from "../presentation/create-scene";
import { createShell } from "../ui/create-shell";

export interface GameApplication {
  dispose(): void;
}

export function createGame(mount: HTMLElement): GameApplication {
  mount.dataset.bootstrap = "booting";

  const shell = createShell(mount);
  const scene = createScene(shell.viewport);

  shell.setStatus(
    scene.available
      ? "Application ready"
      : "Application ready — WebGL unavailable",
  );
  mount.dataset.bootstrap = "ready";

  return {
    dispose(): void {
      scene.dispose();
      shell.dispose();
      delete mount.dataset.bootstrap;
    },
  };
}
