import { createThreeBootstrap, type ThreeBootstrapHandle } from '../presentation/create-three-bootstrap.js';

export interface GameAppHandle {
  readonly shell: HTMLElement;
  dispose(): void;
}

export function createGameApp(documentRef: Document): GameAppHandle {
  const mount = documentRef.querySelector<HTMLElement>('#app');
  if (mount === null) throw new Error('Game bootstrap mount #app was not found.');

  const shell = documentRef.createElement('main');
  shell.dataset.testid = 'game-shell';
  shell.dataset.bootstrapState = 'starting';
  const heading = documentRef.createElement('h1');
  heading.textContent = 'Web Three City';
  const canvas = documentRef.createElement('canvas');
  canvas.dataset.testid = 'three-bootstrap-canvas';
  canvas.setAttribute('aria-label', 'Web Three City bootstrap canvas');
  shell.append(heading, canvas);
  mount.replaceChildren(shell);

  let three: ThreeBootstrapHandle | undefined;
  try {
    three = createThreeBootstrap(canvas);
    shell.dataset.bootstrapState = 'ready';
  } catch (error) {
    shell.dataset.bootstrapState = 'failed';
    throw error;
  }

  let disposed = false;
  return {
    shell,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      three?.dispose();
      shell.remove();
    },
  };
}
