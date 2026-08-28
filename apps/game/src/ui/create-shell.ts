export interface GameShell {
  readonly viewport: HTMLElement;
  setStatus(message: string): void;
  dispose(): void;
}

export function createShell(mount: HTMLElement): GameShell {
  const shell = document.createElement('main');
  shell.className = 'app-shell';

  const header = document.createElement('header');
  header.className = 'app-header';

  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'Web Three City';

  const status = document.createElement('p');
  status.className = 'app-status';
  status.dataset.testid = 'app-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Starting application…';

  header.append(title, status);

  const viewport = document.createElement('section');
  viewport.className = 'app-viewport';
  viewport.dataset.testid = 'viewport';
  viewport.setAttribute('aria-label', '3D city viewport');

  shell.append(header, viewport);
  mount.replaceChildren(shell);

  return {
    viewport,
    setStatus(message: string): void {
      status.textContent = message;
    },
    dispose(): void {
      shell.remove();
    }
  };
}
