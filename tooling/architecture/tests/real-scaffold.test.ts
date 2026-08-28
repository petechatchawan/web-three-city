import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeArchitecture } from '../src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '../../..');

describe('real A12 bootstrap scaffold', () => {
  it('matches the frozen production package boundary without architecture violations', async () => {
    const report = await analyzeArchitecture(repositoryRoot);

    expect(report.packages.map((current) => current.name)).toEqual([
      '@web-three-city/app-game',
      '@web-three-city/foundation-contracts',
      '@web-three-city/tooling-architecture',
    ]);
    expect(report.violations).toEqual([]);
    expect(report.queryEdges).toEqual([]);
    expect(report.edges.some((edge) => edge.sourceProfile !== 'repository-test' && edge.provider === '@web-three-city/tooling-architecture')).toBe(false);
  });
});
