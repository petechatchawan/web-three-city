import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface MaterializableFixture { readonly name: string; readonly files: Readonly<Record<string, string>> }
export async function withFixture<T>(fixture: MaterializableFixture, run: (rootDir: string) => Promise<T>): Promise<T> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), `web-three-city-arch-${fixture.name}-`));
  try {
    for (const [relativePath, content] of Object.entries(fixture.files)) {
      const absolutePath = path.join(rootDir, relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, 'utf8');
    }
    return await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}
