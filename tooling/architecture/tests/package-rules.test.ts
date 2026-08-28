import { describe, expect, it } from 'vitest';
import { invalidPackageFixtures, validPackageFixtures } from '../fixtures/package-cases.js';
import { analyzeArchitecture } from '../src/index.js';
import { withFixture } from './test-workspace.js';

describe('package identity and manifest dependency rules', () => {
  for (const fixture of validPackageFixtures) {
    it(`accepts ${fixture.name}`, async () => {
      await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations).toEqual([]));
    });
  }
  for (const fixture of invalidPackageFixtures) {
    it(`rejects ${fixture.name}`, async () => {
      await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations.map((current) => current.ruleId)).toEqual(fixture.expectedRuleIds));
    });
  }
});
