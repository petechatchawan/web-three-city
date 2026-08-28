import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface FixtureCase {
  readonly name: string;
  readonly scenario: string;
  readonly expectedRuleIds?: readonly string[];
}

type FileMap = Record<string, string>;

const baseWorkspace = `packages:\n  - apps/*\n  - foundation/*\n  - systems/*\n  - orchestration/*\n  - testkit/*\n  - tooling/*\n`;

const emptyPolicy = JSON.stringify(
  {
    version: 1,
    approvedSystemReadEdges: [],
    approvedSameLayerEdges: [],
    packageNameDeviations: [],
    alternateInternalLayouts: []
  },
  null,
  2
);

function packageJson(name: string, options: {
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} = {}): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      exports: options.exports ?? { '.': './src/index.ts' },
      dependencies: options.dependencies ?? {},
      devDependencies: options.devDependencies ?? {}
    },
    null,
    2
  );
}

function root(files: FileMap): FileMap {
  return {
    'package.json': JSON.stringify({ name: 'fixture-root', private: true, type: 'module' }, null, 2),
    'pnpm-workspace.yaml': baseWorkspace,
    'architecture.policy.json': emptyPolicy,
    ...files
  };
}

function system(name: string, source = 'export interface View { readonly id: string; }\n', options: Parameters<typeof packageJson>[1] = {}): FileMap {
  return {
    [`systems/${name}/package.json`]: packageJson(`@web-three-city/${name}`, options),
    [`systems/${name}/src/index.ts`]: source
  };
}

function scenarioFiles(scenario: string): FileMap {
  switch (scenario) {
    case 'minimal-foundation':
      return root({
        'foundation/contracts/package.json': packageJson('@web-three-city/foundation-contracts'),
        'foundation/contracts/src/index.ts': 'export interface ContractValue { readonly value: string; }\n'
      });
    case 'approved-system-read':
      return root({
        ...system('beta', 'export interface BetaView { readonly id: string; }\n'),
        ...system('alpha', "import type { BetaView } from '@web-three-city/beta';\nexport type AlphaView = BetaView;\n", {
          dependencies: { '@web-three-city/beta': 'workspace:*' }
        }),
        'architecture.policy.json': JSON.stringify({
          version: 1,
          approvedSystemReadEdges: [{ from: '@web-three-city/alpha', to: '@web-three-city/beta', reference: 'fixture-spec' }],
          approvedSameLayerEdges: [],
          packageNameDeviations: [],
          alternateInternalLayouts: []
        }, null, 2)
      });
    case 'repository-test-public-surfaces':
      return root({
        ...system('alpha', 'export interface AlphaView { readonly id: string; }\n', {
          exports: {
            '.': './src/index.ts',
            './commands': './src/commands.ts',
            './composition': './src/composition.ts'
          }
        }),
        'systems/alpha/src/commands.ts': 'export interface AlphaCommand { readonly type: "alpha"; }\n',
        'systems/alpha/src/composition.ts': 'export function createAlpha(): object { return {}; }\n',
        'tests/integration/alpha.ts': "import type { AlphaCommand } from '@web-three-city/alpha/commands';\nimport { createAlpha } from '@web-three-city/alpha/composition';\nexport const fixture: [AlphaCommand, object] = [{ type: 'alpha' }, createAlpha()];\n"
      });
    case 'app-composition':
      return root({
        ...system('alpha', 'export interface AlphaView { readonly id: string; }\n', {
          exports: { '.': './src/index.ts', './composition': './src/composition.ts' }
        }),
        'systems/alpha/src/composition.ts': 'export function createAlpha(): object { return {}; }\n',
        'apps/game/package.json': packageJson('@web-three-city/app-game', {
          dependencies: { '@web-three-city/alpha': 'workspace:*' }
        }),
        'apps/game/src/index.ts': "import { createAlpha } from '@web-three-city/alpha/composition';\nexport const alpha = createAlpha();\n"
      });
    case 'foundation-dependency':
      return root({
        'foundation/base/package.json': packageJson('@web-three-city/foundation-base'),
        'foundation/base/src/index.ts': 'export interface BaseValue { readonly value: string; }\n',
        'foundation/upper/package.json': packageJson('@web-three-city/foundation-upper', {
          dependencies: { '@web-three-city/foundation-base': 'workspace:*' }
        }),
        'foundation/upper/src/index.ts': "import type { BaseValue } from '@web-three-city/foundation-base';\nexport type UpperValue = BaseValue;\n"
      });
    case 'generic-package-bucket':
      return {
        ...root({}),
        'pnpm-workspace.yaml': `${baseWorkspace}  - packages/*\n`,
        'packages/foo/package.json': packageJson('@web-three-city/foo'),
        'packages/foo/src/index.ts': 'export const foo = true;\n'
      };
    case 'package-name-mismatch':
      return root({
        'systems/alpha/package.json': packageJson('@web-three-city/system-alpha'),
        'systems/alpha/src/index.ts': 'export const alpha = true;\n'
      });
    case 'unexported-subpath':
      return root({
        ...system('alpha'),
        'apps/game/package.json': packageJson('@web-three-city/app-game', { dependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'apps/game/src/index.ts': "import '@web-three-city/alpha/internal';\n"
      });
    case 'relative-deep-import':
      return root({
        ...system('alpha'),
        'apps/game/package.json': packageJson('@web-three-city/app-game'),
        'apps/game/src/index.ts': "import '../../../systems/alpha/src/index';\n"
      });
    case 'undeclared-dependency':
      return root({
        ...system('alpha'),
        'apps/game/package.json': packageJson('@web-three-city/app-game'),
        'apps/game/src/index.ts': "import type { View } from '@web-three-city/alpha';\nexport type AppView = View;\n"
      });
    case 'dev-only-production-dependency':
      return root({
        ...system('alpha'),
        'apps/game/package.json': packageJson('@web-three-city/app-game', { devDependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'apps/game/src/index.ts': "import type { View } from '@web-three-city/alpha';\nexport type AppView = View;\n"
      });
    case 'unapproved-system-read':
      return root({
        ...system('beta'),
        ...system('alpha', "import type { View } from '@web-three-city/beta';\nexport type AlphaView = View;\n", {
          dependencies: { '@web-three-city/beta': 'workspace:*' }
        })
      });
    case 'system-command':
      return root({
        ...system('beta', 'export interface View { readonly id: string; }\n', { exports: { '.': './src/index.ts', './commands': './src/commands.ts' } }),
        'systems/beta/src/commands.ts': 'export interface BetaCommand { readonly type: "beta"; }\n',
        ...system('alpha', "import type { BetaCommand } from '@web-three-city/beta/commands';\nexport type Command = BetaCommand;\n", { dependencies: { '@web-three-city/beta': 'workspace:*' } })
      });
    case 'system-composition':
      return root({
        ...system('beta', 'export interface View { readonly id: string; }\n', { exports: { '.': './src/index.ts', './composition': './src/composition.ts' } }),
        'systems/beta/src/composition.ts': 'export function createBeta(): object { return {}; }\n',
        ...system('alpha', "import { createBeta } from '@web-three-city/beta/composition';\nexport const beta = createBeta();\n", { dependencies: { '@web-three-city/beta': 'workspace:*' } })
      });
    case 'system-query-cycle':
      return root({
        ...system('alpha', "import type { View as BetaView } from '@web-three-city/beta';\nexport type AlphaView = BetaView;\n", { dependencies: { '@web-three-city/beta': 'workspace:*' } }),
        ...system('beta', "import type { AlphaView } from '@web-three-city/alpha';\nexport type View = AlphaView;\n", { dependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'architecture.policy.json': JSON.stringify({
          version: 1,
          approvedSystemReadEdges: [
            { from: '@web-three-city/alpha', to: '@web-three-city/beta', reference: 'fixture-a' },
            { from: '@web-three-city/beta', to: '@web-three-city/alpha', reference: 'fixture-b' }
          ],
          approvedSameLayerEdges: [], packageNameDeviations: [], alternateInternalLayouts: []
        }, null, 2)
      });
    case 'foundation-upward':
      return root({
        ...system('alpha'),
        'foundation/contracts/package.json': packageJson('@web-three-city/foundation-contracts', { dependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'foundation/contracts/src/index.ts': "import type { View } from '@web-three-city/alpha';\nexport type Contract = View;\n"
      });
    case 'orchestration-composition':
      return root({
        ...system('alpha', 'export interface View { readonly id: string; }\n', { exports: { '.': './src/index.ts', './composition': './src/composition.ts' } }),
        'systems/alpha/src/composition.ts': 'export function createAlpha(): object { return {}; }\n',
        'orchestration/build/package.json': packageJson('@web-three-city/orchestration-build', { dependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'orchestration/build/src/index.ts': "import { createAlpha } from '@web-three-city/alpha/composition';\nexport const alpha = createAlpha();\n"
      });
    case 'testkit-command':
      return root({
        ...system('alpha', 'export interface View { readonly id: string; }\n', { exports: { '.': './src/index.ts', './commands': './src/commands.ts' } }),
        'systems/alpha/src/commands.ts': 'export interface AlphaCommand { readonly type: "alpha"; }\n',
        'testkit/helpers/package.json': packageJson('@web-three-city/testkit-helpers', { dependencies: { '@web-three-city/alpha': 'workspace:*' } }),
        'testkit/helpers/src/index.ts': "import type { AlphaCommand } from '@web-three-city/alpha/commands';\nexport type TestCommand = AlphaCommand;\n"
      });
    case 'contract-port-leak':
      return root({
        ...system('alpha', "export type { PublicQuery } from './contracts/public';\n"),
        'systems/alpha/src/contracts/public.ts': "import type { SecretPort } from '../ports/secret';\nexport interface PublicQuery { readonly port: SecretPort; }\n",
        'systems/alpha/src/ports/secret.ts': 'export interface SecretPort { read(): string; }\n'
      });
    case 'domain-three':
      return root({
        ...system('alpha'),
        'systems/alpha/package.json': packageJson('@web-three-city/alpha', { dependencies: { three: '0.179.1' } }),
        'systems/alpha/src/domain/model.ts': "import { Vector3 } from 'three';\nexport const origin = new Vector3();\n"
      });
    case 'domain-browser-global':
      return root({
        ...system('alpha'),
        'systems/alpha/src/domain/model.ts': 'export const viewportWidth = window.innerWidth;\n'
      });
    case 'domain-outer-layer':
      return root({
        ...system('alpha'),
        'systems/alpha/src/domain/model.ts': "import { run } from '../application/run';\nexport const value = run();\n",
        'systems/alpha/src/application/run.ts': 'export function run(): number { return 1; }\n'
      });
    case 'frozen-placeholder':
      return root({
        'foundation/contracts/package.json': packageJson('@web-three-city/foundation-contracts'),
        'foundation/contracts/src/index.ts': 'export const value = true;\n',
        'docs/architecture/SPEC.md': '# Spec\n\n- **Status:** FROZEN\n\nTODO unresolved requirement.\n'
      });
    default:
      throw new Error(`Unknown fixture scenario: ${scenario}`);
  }
}

export async function materializeFixture(scenario: string): Promise<string> {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'web-three-city-architecture-'));
  const files = scenarioFiles(scenario);
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
  return rootDir;
}
