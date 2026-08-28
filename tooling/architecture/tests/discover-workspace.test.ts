import { describe, expect, it } from 'vitest';
import { discoverWorkspacePackages, expectedPackageName, parseWorkspacePatterns } from '../src/workspace/discover-workspace.js';
import { withFixture } from './test-workspace.js';

const fixture = { name: 'workspace-discovery', files: {
  'pnpm-workspace.yaml': `packages:\n  - apps/*\n  - foundation/*\n`,
  'apps/game/package.json': JSON.stringify({ name: '@web-three-city/app-game', exports: {} }),
  'foundation/contracts/package.json': JSON.stringify({ name: '@web-three-city/foundation-contracts', exports: { '.': './src/index.ts' } }),
} } as const;

describe('workspace discovery', () => {
  it('parses workspace patterns deterministically', () => {
    expect(parseWorkspacePatterns(`packages:\n  - apps/*\n  - 'foundation/*' # comment\n`)).toEqual(['apps/*', 'foundation/*']);
  });
  it('discovers package roots and profiles from the workspace', async () => {
    await withFixture(fixture, async (rootDir) => {
      const packages = await discoverWorkspacePackages(rootDir);
      expect(packages.map((current) => ({ name: current.name, relativeRoot: current.relativeRoot, profile: current.profile }))).toEqual([
        { name: '@web-three-city/app-game', relativeRoot: 'apps/game', profile: 'application' },
        { name: '@web-three-city/foundation-contracts', relativeRoot: 'foundation/contracts', profile: 'foundation' },
      ]);
    });
  });
  it('derives the frozen package naming policy', () => {
    expect(expectedPackageName('systems/roads')).toBe('@web-three-city/roads');
    expect(expectedPackageName('apps/game')).toBe('@web-three-city/app-game');
    expect(expectedPackageName('foundation/contracts')).toBe('@web-three-city/foundation-contracts');
    expect(expectedPackageName('tooling/architecture')).toBe('@web-three-city/tooling-architecture');
  });
});
