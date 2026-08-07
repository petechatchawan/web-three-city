#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'

cat > packages/terrain-core/src/serialization.ts <<'EOF'
import { err, ok, WORLD_CONFIG } from '@web-three-city/world-core';
import type { Result } from '@web-three-city/world-core';
import { createTerrainMap } from './terrain-map.js';
import type { TerrainMap } from './terrain-map.js';

export interface TerrainSaveV1 {
  readonly schemaVersion: 1;
  readonly generatorVersion: 'coastal-v1';
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly generationAttempt: number;
  readonly revision: number;
  readonly heightLevels: string;
}

export type TerrainSaveErrorCode =
  | 'terrain-save:invalid-schema'
  | 'terrain-save:invalid-dimensions'
  | 'terrain-save:invalid-metadata'
  | 'terrain-save:invalid-base64'
  | 'terrain-save:invalid-byte-length'
  | 'terrain-save:invalid-terrain';

export interface TerrainSaveError {
  readonly code: TerrainSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    encoded += BASE64_ALPHABET[(value >>> 18) & 63];
    encoded += BASE64_ALPHABET[(value >>> 12) & 63];
    encoded += hasSecond ? BASE64_ALPHABET[(value >>> 6) & 63] : '=';
    encoded += hasThird ? BASE64_ALPHABET[value & 63] : '=';
  }
  return encoded;
}

function base64ToBytes(value: string): Uint8Array | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let output = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(value[index]!);
    const second = BASE64_ALPHABET.indexOf(value[index + 1]!);
    const third = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]!);
    const fourth = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]!);
    const decoded = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (output < bytes.length) bytes[output++] = (decoded >>> 16) & 255;
    if (output < bytes.length) bytes[output++] = (decoded >>> 8) & 255;
    if (output < bytes.length) bytes[output++] = decoded & 255;
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function encodeTerrainSaveV1(map: TerrainMap): TerrainSaveV1 {
  return {
    schemaVersion: 1,
    generatorVersion: 'coastal-v1',
    width: map.width,
    height: map.height,
    seed: map.seed,
    generationAttempt: map.generationAttempt,
    revision: map.revision,
    heightLevels: bytesToBase64(map.heightLevels),
  };
}

export function decodeTerrainSaveV1(input: unknown): Result<TerrainMap, TerrainSaveError> {
  if (!isRecord(input) || input.schemaVersion !== 1 || input.generatorVersion !== 'coastal-v1') {
    return err({ code: 'terrain-save:invalid-schema' });
  }

  if (input.width !== WORLD_CONFIG.mapWidth || input.height !== WORLD_CONFIG.mapHeight) {
    return err({ code: 'terrain-save:invalid-dimensions' });
  }

  if (
    !isInteger(input.seed) ||
    !isInteger(input.generationAttempt) ||
    input.generationAttempt < 0 ||
    !isInteger(input.revision) ||
    input.revision < 0 ||
    typeof input.heightLevels !== 'string'
  ) {
    return err({ code: 'terrain-save:invalid-metadata' });
  }

  const bytes = base64ToBytes(input.heightLevels);
  if (bytes === null) return err({ code: 'terrain-save:invalid-base64' });

  const expectedLength = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);
  if (bytes.length !== expectedLength) {
    return err({
      code: 'terrain-save:invalid-byte-length',
      details: { expected: expectedLength, actual: bytes.length },
    });
  }

  try {
    return ok(
      createTerrainMap({
        config: WORLD_CONFIG,
        heightLevels: bytes,
        seed: input.seed,
        generatorVersion: 'coastal-v1',
        generationAttempt: input.generationAttempt,
        revision: input.revision,
      }),
    );
  } catch {
    return err({ code: 'terrain-save:invalid-terrain' });
  }
}
EOF

python <<'PY'
from pathlib import Path
p = Path('packages/terrain-core/test/serialization.test.ts')
text = p.read_text()
marker = "describe('terrain serialization', () => {\n"
test = """  it('preserves the canonical TerrainSaveV1 base64 wire representation without DOM codecs', () => {\n    const levels = new Uint8Array(129 * 129).fill(2);\n    const map = createTerrainMap({\n      config: WORLD_CONFIG,\n      seed: 1,\n      generatorVersion: 'coastal-v1',\n      generationAttempt: 0,\n      revision: 0,\n      heightLevels: levels,\n    });\n\n    expect(encodeTerrainSaveV1(map).heightLevels).toBe('AgIC'.repeat((129 * 129) / 3));\n  });\n\n"""
if "preserves the canonical TerrainSaveV1" not in text:
    text = text.replace(marker, marker + test, 1)
p.write_text(text)
PY

python <<'PY'
from pathlib import Path
source = Path('.github/workflows/architecture-pr1-implement.yml').read_text().splitlines()
start = next(i for i, line in enumerate(source) if line.strip() == 'run: |') + 1
script_lines = []
for line in source[start:]:
    if line and not line.startswith('          '):
        break
    script_lines.append(line[10:] if len(line) >= 10 else '')
script = '\n'.join(script_lines) + '\n'
script = script.replace("import { fileURLToPath } from 'node:url';", "import { fileURLToPath, URL } from 'node:url';")
script = script.replace(
    'git rm .github/workflows/architecture-pr1-implement.yml',
    'git rm .github/workflows/architecture-pr1-implement.yml .github/workflows/architecture-pr1-finalize.yml .github/workflows/architecture-pr1-finalize2.yml .github/workflows/architecture-pr1-runner.yml tooling/architecture-pr1-author.sh',
    1,
)
script = script.replace(
    'git add package.json',
    'git add packages/terrain-core/src/serialization.ts packages/terrain-core/test/serialization.test.ts package.json',
    1,
)
Path('/tmp/architecture-pr1.sh').write_text(script)
PY

bash /tmp/architecture-pr1.sh
