import './style.css';
import { bootstrapTerrainLab } from './bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('terrain-lab:missing-root');
bootstrapTerrainLab(root);
