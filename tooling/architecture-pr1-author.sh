#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'

python <<'PY'
from pathlib import Path

codec = r'''const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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
'''

for filename in [
    'packages/terrain-core/src/serialization.ts',
    'packages/road-core/src/serialization.ts',
    'packages/zone-core/src/serialization.ts',
]:
    path = Path(filename)
    text = path.read_text()
    start = text.index('function bytesToBase64')
    end = text.index('\nfunction isRecord', start)
    path.write_text(text[:start] + codec + text[end:])

terrain = Path('packages/terrain-core/test/serialization.test.ts')
text = terrain.read_text()
if 'preserves the canonical TerrainSaveV1 base64 wire representation without DOM codecs' not in text:
    marker = "describe('terrain serialization', () => {\n"
    test = """  it('preserves the canonical TerrainSaveV1 base64 wire representation without DOM codecs', () => {\n    const levels = new Uint8Array(129 * 129).fill(2);\n    const map = createTerrainMap({\n      config: WORLD_CONFIG,\n      seed: 1,\n      generatorVersion: 'coastal-v1',\n      generationAttempt: 0,\n      revision: 0,\n      heightLevels: levels,\n    });\n\n    expect(encodeTerrainSaveV1(map).heightLevels).toBe('AgIC'.repeat((129 * 129) / 3));\n  });\n\n"""
    terrain.write_text(text.replace(marker, marker + test, 1))

road = Path('packages/road-core/test/serialization.test.ts')
text = road.read_text()
if 'preserves the canonical zero-byte RoadSaveV1 base64 wire representation without DOM codecs' not in text:
    marker = "describe('RoadSaveV1', () => {\n"
    test = """  it('preserves the canonical zero-byte RoadSaveV1 base64 wire representation without DOM codecs', () => {\n    const snapshot = createRoadSnapshot(\n      {\n        width: WORLD_CONFIG.mapWidth,\n        height: WORLD_CONFIG.mapHeight,\n        revision: 0,\n        definitionCodes: new Uint8Array(CELL_COUNT),\n      },\n      WORLD_CONFIG,\n    );\n\n    expect(CELL_COUNT % 3).toBe(1);\n    expect(encodeRoadSaveV1(snapshot).definitionCodes).toBe(\n      'AAAA'.repeat(Math.floor(CELL_COUNT / 3)) + 'AA==',\n    );\n  });\n\n"""
    road.write_text(text.replace(marker, marker + test, 1))

zone = Path('packages/zone-core/test/serialization.test.ts')
text = zone.read_text()
if 'preserves the canonical zero-byte ZoneSaveV1 base64 wire representation without DOM codecs' not in text:
    marker = "describe('ZoneSaveV1', () => {\n"
    test = """  it('preserves the canonical zero-byte ZoneSaveV1 base64 wire representation without DOM codecs', () => {\n    const snapshot = createZoneSnapshot(\n      {\n        width: WORLD_CONFIG.mapWidth,\n        height: WORLD_CONFIG.mapHeight,\n        revision: 0,\n        definitionCodes: new Uint8Array(CELL_COUNT),\n      },\n      WORLD_CONFIG,\n    );\n\n    expect(CELL_COUNT % 3).toBe(1);\n    expect(encodeZoneSaveV1(snapshot).definitionCodes).toBe(\n      'AAAA'.repeat(Math.floor(CELL_COUNT / 3)) + 'AA==',\n    );\n  });\n\n"""
    zone.write_text(text.replace(marker, marker + test, 1))

rci = Path('packages/rci-core/src/population/deterministic-sample.ts')
text = rci.read_text()
helper = r'''function utf8Bytes(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const symbol of value) {
    let codePoint = symbol.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) codePoint = 0xfffd;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

'''
if 'function utf8Bytes' not in text:
    marker = "export const DETERMINISTIC_SAMPLE_ALGORITHM = 'fnv1a32-null-delimited-v1';\n\n"
    text = text.replace(marker, marker + helper, 1)
text = text.replace('  const bytes = new TextEncoder().encode(canonical);', '  const bytes = utf8Bytes(canonical);')
rci.write_text(text)

rci_test = Path('packages/rci-core/test/deterministic-sample.test.ts')
text = rci_test.read_text()
if 'matches TextEncoder replacement semantics for lone surrogates' not in text:
    marker = "  it('keeps samples inside the integer probability domain', () => {\n"
    test = """  it('matches TextEncoder replacement semantics for lone surrogates', () => {\n    expect(\n      deterministicSample({\n        seed: 1,\n        eventType: 'birth',\n        evaluationTick: 32,\n        entityStableId: '\\uD800',\n        attemptIndex: 0,\n      }),\n    ).toBe(706_692_611);\n  });\n\n"""
    rci_test.write_text(text.replace(marker, test + marker, 1))
PY

if grep -R -nE '\b(atob|btoa|TextEncoder|TextDecoder)\b' packages/*-core/src packages/terrain-generator/src; then
  echo 'Platform ambient codec remains in deterministic core source.' >&2
  exit 1
fi

python <<'PY'
from pathlib import Path
source = Path('tooling/architecture-pr1-implement-source.yml').read_text().splitlines()
start = next(i for i, line in enumerate(source) if line.strip() == 'run: |') + 1
script_lines = []
for line in source[start:]:
    if line and not line.startswith('          '):
        break
    script_lines.append(line[10:] if len(line) >= 10 else '')
script = '\n'.join(script_lines) + '\n'
script = script.replace("import { fileURLToPath } from 'node:url';", "import { fileURLToPath, URL } from 'node:url';")
script = script.replace(
    "pnpm --filter @web-three-city/shared-testkit typecheck\n",
    "pnpm --filter @web-three-city/shared-testkit typecheck\nfor pkg in world-core simulation-core terrain-core water-core road-core zone-core building-core rci-core terrain-generator; do pnpm --filter @web-three-city/$pkg build; done\n",
    1,
)
script = script.replace(
    'git rm .github/workflows/architecture-pr1-implement.yml',
    'git rm .github/workflows/architecture-pr1-runner.yml tooling/architecture-pr1-author.sh tooling/architecture-pr1-implement-source.yml',
    1,
)
script = script.replace(
    'git add package.json',
    'git add packages/terrain-core/src/serialization.ts packages/terrain-core/test/serialization.test.ts packages/road-core/src/serialization.ts packages/road-core/test/serialization.test.ts packages/zone-core/src/serialization.ts packages/zone-core/test/serialization.test.ts packages/rci-core/src/population/deterministic-sample.ts packages/rci-core/test/deterministic-sample.test.ts package.json',
    1,
)
Path('/tmp/architecture-pr1.sh').write_text(script)
PY

bash /tmp/architecture-pr1.sh
