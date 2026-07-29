import './style.css';
import { bootstrapGame } from './game-bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);

root.querySelector('[data-action="save"]')?.setAttribute('aria-label', 'Save terrain');
root.querySelector('[data-action="load"]')?.setAttribute('aria-label', 'Load terrain');
root.querySelector('[data-action="undo"]')?.setAttribute('aria-label', 'Undo Terraform');
