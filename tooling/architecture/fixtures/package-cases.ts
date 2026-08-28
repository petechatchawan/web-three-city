export interface ArchitectureFixtureCase {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly expectedRuleIds: readonly string[];
}

const workspace = `packages:\n  - apps/*\n  - systems/*\n  - orchestration/*\n  - foundation/*\n  - testkit/*\n  - tooling/*\n  - packages/*\n`;
function manifest(name: string, dependencies: Readonly<Record<string, string>> = {}): string {
  return JSON.stringify({ name, private: true, type: 'module', exports: { '.': './src/index.ts' }, dependencies }, null, 2);
}
function base(files: Readonly<Record<string, string>>): Readonly<Record<string, string>> { return { 'pnpm-workspace.yaml': workspace, ...files }; }

export const validPackageFixtures: readonly ArchitectureFixtureCase[] = [
  {
    name: 'declared-foundation-dependency',
    files: base({
      'foundation/alpha/package.json': manifest('@web-three-city/foundation-alpha', { '@web-three-city/foundation-beta': 'workspace:*' }),
      'foundation/alpha/src/index.ts': `import type { Beta } from '@web-three-city/foundation-beta';\nexport type Alpha = Beta;\n`,
      'foundation/beta/package.json': manifest('@web-three-city/foundation-beta'),
      'foundation/beta/src/index.ts': `export interface Beta { readonly value: number }\n`,
    }),
    expectedRuleIds: [],
  },
];

export const invalidPackageFixtures: readonly ArchitectureFixtureCase[] = [
  { name: 'package-name-mismatch', files: base({ 'systems/alpha/package.json': manifest('@web-three-city/not-alpha'), 'systems/alpha/src/index.ts': `export const value = 1;\n` }), expectedRuleIds: ['ARCH-PKG-001'] },
  { name: 'outside-owned-namespace', files: base({ 'packages/alpha/package.json': manifest('@web-three-city/alpha'), 'packages/alpha/src/index.ts': `export const value = 1;\n` }), expectedRuleIds: ['ARCH-PKG-002'] },
  {
    name: 'undeclared-dependency',
    files: base({
      'foundation/alpha/package.json': manifest('@web-three-city/foundation-alpha'),
      'foundation/alpha/src/index.ts': `import type { Beta } from '@web-three-city/foundation-beta';\nexport type Alpha = Beta;\n`,
      'foundation/beta/package.json': manifest('@web-three-city/foundation-beta'),
      'foundation/beta/src/index.ts': `export interface Beta { readonly value: number }\n`,
    }),
    expectedRuleIds: ['ARCH-DEP-001'],
  },
  {
    name: 'production-to-tooling',
    files: base({
      'apps/game/package.json': manifest('@web-three-city/app-game', { '@web-three-city/tooling-alpha': 'workspace:*' }),
      'apps/game/src/index.ts': `import { inspect } from '@web-three-city/tooling-alpha';\ninspect();\n`,
      'tooling/alpha/package.json': manifest('@web-three-city/tooling-alpha'),
      'tooling/alpha/src/index.ts': `export function inspect(): void {}\n`,
    }),
    expectedRuleIds: ['ARCH-DEP-002'],
  },
  {
    name: 'production-to-testkit',
    files: base({
      'apps/game/package.json': manifest('@web-three-city/app-game', { '@web-three-city/testkit-alpha': 'workspace:*' }),
      'apps/game/src/index.ts': `import { helper } from '@web-three-city/testkit-alpha';\nhelper();\n`,
      'testkit/alpha/package.json': manifest('@web-three-city/testkit-alpha'),
      'testkit/alpha/src/index.ts': `export function helper(): void {}\n`,
    }),
    expectedRuleIds: ['ARCH-DEP-002'],
  },
];
