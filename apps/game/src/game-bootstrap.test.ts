import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');

function section(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`missing bootstrap section: ${start}`);
  return source.slice(from, to);
}

describe('game bootstrap light theme renderer', () => {
  it('creates the WebGL renderer with a transparent alpha channel', () => {
    const rendererSetup = section('const renderer = new THREE.WebGLRenderer', 'renderer.autoClear');
    expect(rendererSetup).toMatch(/alpha: true/);
  });

  it('clears transparently so the CSS sky shows through', () => {
    const rendererSetup = section(
      'renderer.autoClear = false;',
      'const scene = new THREE.Scene();',
    );
    expect(rendererSetup).toMatch(/setClearColor\(0, 0\)/);
    expect(rendererSetup).not.toMatch(/setClearColor\(0x/);
  });

  it('removes the solid scene background color', () => {
    const sceneSetup = section('const scene = new THREE.Scene();', 'scene.add');
    expect(sceneSetup).toMatch(/scene\.background = null/);
    expect(sceneSetup).not.toMatch(/scene\.background = new THREE\.Color/);
  });
});
