import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTrafficGraphCache } from './traffic-graph-cache.js';

const bootstrapSource = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');

describe('Traffic graph authority cache', () => {
  it('reuses the prepared graph across transport quanta until static authority changes', () => {
    expect(bootstrapSource).toMatch(/createTrafficGraphCache/);
    expect(bootstrapSource).toMatch(/trafficGraphCache\.get/);
  });

  it('does not rebuild for a dynamic transport snapshot', () => {
    const cache = createTrafficGraphCache<{ id: number }>();
    const roads = {};
    const environment = {};
    const buildings = {};
    const create = vi.fn(() => ({ id: 1 }));

    const first = cache.get(roads, environment, buildings, create);
    const second = cache.get(roads, environment, buildings, create);

    expect(second).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when a static authority object changes', () => {
    const cache = createTrafficGraphCache<{ id: number }>();
    const roads = {};
    const environment = {};
    const create = vi.fn((id: number) => ({ id }));

    const first = cache.get(roads, environment, {}, () => create(1));
    const second = cache.get(roads, environment, {}, () => create(2));

    expect(second).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
