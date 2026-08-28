import '../style.css';
import { createGame } from '../composition/create-game';

const mount = document.querySelector<HTMLElement>('#app');

if (!mount) {
  throw new Error('Application mount #app was not found.');
}

const application = createGame(mount);

window.addEventListener(
  'pagehide',
  () => {
    application.dispose();
  },
  { once: true }
);
