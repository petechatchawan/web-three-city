#!/usr/bin/env node

import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ABSOLUTE_ASSET_REFERENCE = /(?:src|href)\s*=\s*["']\/assets\//i;

async function validateApplication(name, directory) {
  const indexPath = join(directory, 'index.html');
  try {
    await access(indexPath);
  } catch {
    throw new Error(`${name}:index-missing:${indexPath}`);
  }

  const html = await readFile(indexPath, 'utf8');
  if (ABSOLUTE_ASSET_REFERENCE.test(html)) {
    throw new Error(`${name}:absolute-assets:${indexPath}`);
  }
}

async function replaceDirectory(staging, output) {
  const backup = `${output}.previous`;
  await rm(backup, { recursive: true, force: true });

  let hadPreviousOutput = false;
  try {
    await rename(output, backup);
    hadPreviousOutput = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  try {
    await rename(staging, output);
  } catch (error) {
    if (hadPreviousOutput) await rename(backup, output);
    throw error;
  }

  if (hadPreviousOutput) await rm(backup, { recursive: true, force: true });
}

export async function composeVercelOutput({ game, terrainLab, output }) {
  const gameDirectory = resolve(game);
  const terrainLabDirectory = resolve(terrainLab);
  const outputDirectory = resolve(output);

  await Promise.all([
    validateApplication('game', gameDirectory),
    validateApplication('terrain-lab', terrainLabDirectory),
  ]);

  const outputParent = dirname(outputDirectory);
  await mkdir(outputParent, { recursive: true });
  const staging = await mkdtemp(join(outputParent, '.vercel-output-'));

  try {
    const staticDirectory = join(staging, 'static');
    const terrainLabOutput = join(staticDirectory, 'terrain-lab');
    await mkdir(staticDirectory, { recursive: true });
    await cp(gameDirectory, staticDirectory, { recursive: true });
    await mkdir(terrainLabOutput, { recursive: true });
    await cp(terrainLabDirectory, terrainLabOutput, { recursive: true });
    await writeFile(join(staging, 'config.json'), '{\n  "version": 3\n}\n', 'utf8');
    await replaceDirectory(staging, outputDirectory);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  return Object.freeze({
    gameIndex: join(outputDirectory, 'static', 'index.html'),
    terrainLabIndex: join(outputDirectory, 'static', 'terrain-lab', 'index.html'),
    config: join(outputDirectory, 'config.json'),
  });
}

function parseArguments(argv) {
  const options = {
    game: 'apps/game/dist',
    terrainLab: 'apps/terrain-lab/dist',
    output: '.vercel/output',
  };
  const names = new Map([
    ['--game', 'game'],
    ['--terrain-lab', 'terrainLab'],
    ['--output', 'output'],
  ]);

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const key = names.get(flag);
    const value = argv[index + 1];
    if (key === undefined || value === undefined) {
      throw new Error(`usage:compose-vercel-output:${flag ?? 'missing-flag'}`);
    }
    options[key] = value;
  }

  return options;
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    const result = await composeVercelOutput(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
