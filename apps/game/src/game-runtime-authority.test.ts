import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
const bootstrapSource = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');

describe('GameRuntime committed-world authority', () => {
  it('keeps Save decoding, storage reads, and Building authority out of main.ts', () => {
    expect(mainSource).not.toMatch(
      /latestPresentedBuildingSnapshot|decodeWorldSave|localStorage|WORLD_SAVE_KEYS|CURRENT_WORLD_SAVE_KEY/,
    );
    expect(mainSource).toMatch(/runtime\.snapshot\(\)/);
    expect(mainSource).toMatch(/runtime\.subscribeCommittedWorld/);
    expect(mainSource).toMatch(/runtime\.advanceGameMinute/);
    expect(mainSource).toMatch(/runtime\.advanceTransportQuantum/);
    expect(mainSource).toMatch(/runtime\.savePayload\(\)/);
  });

  it('exposes one committed-world read and tick command surface', () => {
    expect(bootstrapSource).toMatch(/snapshot\(\): CommittedWorld/);
    expect(bootstrapSource).toMatch(/subscribeCommittedWorld/);
    expect(bootstrapSource).toMatch(/advanceGameMinute/);
    expect(bootstrapSource).toMatch(/advanceTransportQuantum/);
    expect(bootstrapSource).toMatch(/savePayload/);
  });
});
