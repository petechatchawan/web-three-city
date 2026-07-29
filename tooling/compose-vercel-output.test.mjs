import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { composeVercelOutput } from './compose-vercel-output.mjs';

async function createApp(directory, assetReference = './assets/app.js') {
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(
    join(directory, 'index.html'),
    `<!doctype html><html><body><script type="module" src="${assetReference}"></script></body></html>\n`,
    'utf8',
  );
  await writeFile(join(directory, 'assets', 'app.js'), 'console.log("ready");\n', 'utf8');
}

async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'web-three-city-vercel-'));
  try {
    await run({
      game: join(root, 'game'),
      terrainLab: join(root, 'terrain-lab'),
      output: join(root, '.vercel', 'output'),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('composes Game and Terrain Lab into Build Output API v3', async () => {
  await withFixture(async ({ game, terrainLab, output }) => {
    await createApp(game);
    await createApp(terrainLab);

    const result = await composeVercelOutput({ game, terrainLab, output });

    assert.deepEqual(result, {
      gameIndex: join(output, 'static', 'index.html'),
      terrainLabIndex: join(output, 'static', 'terrain-lab', 'index.html'),
      config: join(output, 'config.json'),
    });
    assert.deepEqual(JSON.parse(await readFile(result.config, 'utf8')), { version: 3 });
    await stat(join(output, 'static', 'assets', 'app.js'));
    await stat(join(output, 'static', 'terrain-lab', 'assets', 'app.js'));
  });
});

test('replaces stale output atomically after validating both inputs', async () => {
  await withFixture(async ({ game, terrainLab, output }) => {
    await createApp(game);
    await createApp(terrainLab);
    await mkdir(join(output, 'static'), { recursive: true });
    await writeFile(join(output, 'static', 'stale.txt'), 'stale\n', 'utf8');

    await composeVercelOutput({ game, terrainLab, output });

    await assert.rejects(stat(join(output, 'static', 'stale.txt')), { code: 'ENOENT' });
  });
});

test('rejects an application without index.html before replacing output', async () => {
  await withFixture(async ({ game, terrainLab, output }) => {
    await createApp(game);
    await mkdir(terrainLab, { recursive: true });
    await mkdir(join(output, 'static'), { recursive: true });
    await writeFile(join(output, 'static', 'sentinel.txt'), 'preserve\n', 'utf8');

    await assert.rejects(
      composeVercelOutput({ game, terrainLab, output }),
      /terrain-lab:index-missing/,
    );
    assert.equal(await readFile(join(output, 'static', 'sentinel.txt'), 'utf8'), 'preserve\n');
  });
});

test('rejects root-absolute asset references', async () => {
  await withFixture(async ({ game, terrainLab, output }) => {
    await createApp(game, '/assets/app.js');
    await createApp(terrainLab);

    await assert.rejects(composeVercelOutput({ game, terrainLab, output }), /game:absolute-assets/);
  });
});
