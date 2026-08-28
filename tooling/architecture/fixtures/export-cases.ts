export interface ArchitectureFixtureCase {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly expectedRuleIds: readonly string[];
}
const workspace = `packages:\n  - apps/*\n  - systems/*\n  - foundation/*\n`;
function manifest(name: string, exports: Readonly<Record<string, string>>, dependencies: Readonly<Record<string, string>> = {}): string {
  return JSON.stringify({ name, private: true, type: 'module', exports, dependencies }, null, 2);
}
function base(files: Readonly<Record<string, string>>): Readonly<Record<string, string>> { return { 'pnpm-workspace.yaml': workspace, ...files }; }

export const validExportFixtures: readonly ArchitectureFixtureCase[] = [
  {
    name: 'exported-subpath',
    files: base({
      'apps/game/package.json': manifest('@web-three-city/app-game', {}, { '@web-three-city/alpha': 'workspace:*' }),
      'apps/game/src/main.ts': `import type { AlphaFactory } from '@web-three-city/alpha/composition';\nexport type AppFactory = AlphaFactory;\n`,
      'systems/alpha/package.json': manifest('@web-three-city/alpha', { '.': './src/index.ts', './composition': './src/composition.ts' }),
      'systems/alpha/src/index.ts': `export interface AlphaView { readonly value: number }\n`,
      'systems/alpha/src/composition.ts': `export interface AlphaFactory { create(): unknown }\n`,
    }),
    expectedRuleIds: [],
  },
];

export const invalidExportFixtures: readonly ArchitectureFixtureCase[] = [
  {
    name: 'deep-package-import',
    files: base({
      'apps/game/package.json': manifest('@web-three-city/app-game', {}, { '@web-three-city/alpha': 'workspace:*' }),
      'apps/game/src/main.ts': `import { hidden } from '@web-three-city/alpha/src/private';\nhidden();\n`,
      'systems/alpha/package.json': manifest('@web-three-city/alpha', { '.': './src/index.ts' }),
      'systems/alpha/src/index.ts': `export const visible = 1;\n`,
      'systems/alpha/src/private.ts': `export function hidden(): void {}\n`,
    }),
    expectedRuleIds: ['ARCH-EXPORT-001'],
  },
  {
    name: 'relative-reach-through',
    files: base({
      'foundation/alpha/package.json': manifest('@web-three-city/foundation-alpha', { '.': './src/index.ts' }, { '@web-three-city/foundation-beta': 'workspace:*' }),
      'foundation/alpha/src/index.ts': `import type { Hidden } from '../../beta/src/private.js';\nexport type Alpha = Hidden;\n`,
      'foundation/beta/package.json': manifest('@web-three-city/foundation-beta', { '.': './src/index.ts' }),
      'foundation/beta/src/index.ts': `export interface Beta { readonly value: number }\n`,
      'foundation/beta/src/private.ts': `export interface Hidden { readonly secret: string }\n`,
    }),
    expectedRuleIds: ['ARCH-EXPORT-002'],
  },
  {
    name: 'alias-private-path',
    files: base({
      'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@private-beta/*': ['foundation/beta/src/*'] } } }, null, 2),
      'foundation/alpha/package.json': manifest('@web-three-city/foundation-alpha', { '.': './src/index.ts' }, { '@web-three-city/foundation-beta': 'workspace:*' }),
      'foundation/alpha/src/index.ts': `import type { Hidden } from '@private-beta/private';\nexport type Alpha = Hidden;\n`,
      'foundation/beta/package.json': manifest('@web-three-city/foundation-beta', { '.': './src/index.ts' }),
      'foundation/beta/src/index.ts': `export interface Beta { readonly value: number }\n`,
      'foundation/beta/src/private.ts': `export interface Hidden { readonly secret: string }\n`,
    }),
    expectedRuleIds: ['ARCH-EXPORT-003'],
  },
];
