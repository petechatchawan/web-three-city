import { describe, expect, it } from 'vitest';
import { invalidExportFixtures, validExportFixtures } from '../fixtures/export-cases.js';
import { analyzeArchitecture } from '../src/index.js';
import { withFixture } from './test-workspace.js';

describe('explicit package export boundaries', () => {
  for (const fixture of validExportFixtures) {
    it(`accepts ${fixture.name}`, async () => {
      await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations).toEqual([]));
    });
  }
  for (const fixture of invalidExportFixtures) {
    it(`rejects ${fixture.name}`, async () => {
      await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations.map((current) => current.ruleId)).toEqual(fixture.expectedRuleIds));
    });
  }
});
