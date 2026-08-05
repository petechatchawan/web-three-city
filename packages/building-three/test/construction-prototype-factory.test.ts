import { describe, expect, it } from 'vitest';
import {
  constructionVisualPhase,
  createBuildingMaterials,
  createConstructionPrototype,
} from '../src/index.js';

describe('Construction presentation phases', () => {
  it('derives exact phase boundaries', () => {
    expect(constructionVisualPhase(0)).toBe('foundation');
    expect(constructionVisualPhase(1 / 3)).toBe('foundation');
    expect(constructionVisualPhase(0.34)).toBe('frame');
    expect(constructionVisualPhase(2 / 3)).toBe('frame');
    expect(constructionVisualPhase(0.67)).toBe('shell');
  });

  it('creates distinct named cube-composed groups', () => {
    const materials = createBuildingMaterials();
    for (const phase of ['foundation', 'frame', 'shell'] as const) {
      const group = createConstructionPrototype({
        footprintWidth: 2,
        footprintDepth: 2,
        prototypeHeight: 1.5,
        phase,
        materials,
      });
      expect(group.name).toBe(`building-construction-${phase}`);
      expect(group.children.length).toBeGreaterThan(0);
    }
    materials.dispose();
  });
});
