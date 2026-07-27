import './style.css';
import { bootstrapGame } from './game-bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);
