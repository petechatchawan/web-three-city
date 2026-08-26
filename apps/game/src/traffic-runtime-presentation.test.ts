import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TrafficRuntimePresentation } from './traffic-runtime-presentation.js';

describe('Traffic runtime presentation', () => {
  it('contains no replay pools, timing constants, or receipt-to-presentation dependency', () => {
    const sourceFiles = ['./traffic-runtime-presentation.ts', './main.ts', './game-world-tick.ts'];
    const forbiddenProductionTokens = [
      'JourneyReplay',
      'replayVehicles',
      'replayPedestrians',
      'REPLAY_',
      'enqueueJourneyReceipts',
      'traffic-journey-receipt-registry',
    ];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(fileURLToPath(new URL(sourceFile, import.meta.url)), 'utf8');
      for (const token of forbiddenProductionTokens) {
        expect(source, `${sourceFile} must not depend on ${token}`).not.toContain(token);
      }
    }
    expect('enqueueJourneyReceipts' in TrafficRuntimePresentation.prototype).toBe(false);
  });
});
