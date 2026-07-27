#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOTS = ['apps', 'packages'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.css', '.html', '.json']);
const FORBIDDEN_PATTERNS = [
  { name: 'lo-th/3d.city source marker', pattern: /lo-th\s*\/\s*3d\.city/i },
  { name: 'Micropolis source marker', pattern: /micropolis/i },
  { name: 'Unity runtime source marker', pattern: /\busing\s+UnityEngine\b|\bMonoBehaviour\b/ },
  { name: 'Unity serialized scene marker', pattern: /%YAML\s+1\.1[\s\S]*!u!/ },
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'coverage') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(path)));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const files = [];
for (const root of ROOTS) files.push(...(await collectSourceFiles(root)));

const violations = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(content)) violations.push(`${file}: ${forbidden.name}`);
  }
}

if (violations.length > 0) {
  console.error('Forbidden source provenance markers found:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Provenance check passed for ${files.length} source files.`);
