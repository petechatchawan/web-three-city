import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectImportsFromDirectories } from '../src/source/collect-imports.js';

describe('source import collection', () => {
  it('includes value, type-only, re-export, dynamic import, and require edges', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'web-three-city-imports-'));
    try {
      const sourceDir = path.join(rootDir, 'source');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(path.join(sourceDir, 'index.ts'), [
        `import { value } from 'value-package';`, `import type { TypeValue } from 'type-package';`,
        `export { other } from 'export-package';`, `export type { OtherType } from 'export-type-package';`,
        `void import('dynamic-package');`, `require('require-package');`, `void value;`,
      ].join('\n'), 'utf8');
      const imports = await collectImportsFromDirectories(rootDir, [sourceDir]);
      expect(imports.map((current) => ({ specifier: current.specifier, kind: current.kind, isTypeOnly: current.isTypeOnly }))).toEqual([
        { specifier: 'dynamic-package', kind: 'dynamic-import', isTypeOnly: false },
        { specifier: 'export-package', kind: 'export', isTypeOnly: false },
        { specifier: 'export-type-package', kind: 'export', isTypeOnly: true },
        { specifier: 'require-package', kind: 'require', isTypeOnly: false },
        { specifier: 'type-package', kind: 'import', isTypeOnly: true },
        { specifier: 'value-package', kind: 'import', isTypeOnly: false },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
