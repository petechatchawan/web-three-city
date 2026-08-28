import { describe, expect, it } from 'vitest';
import { invalidStructureFixtures, validStructureFixtures } from '../fixtures/structure-cases.js';
import { analyzeArchitecture } from '../src/index.js';
import { withFixture } from './test-workspace.js';

describe('test, contract, technology and package-cycle boundaries', () => {
  for (const fixture of validStructureFixtures) it(`accepts ${fixture.name}`, async () => { await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations).toEqual([])); });
  for (const fixture of invalidStructureFixtures) it(`rejects ${fixture.name}`, async () => { await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations.map((current) => current.ruleId)).toEqual(fixture.expectedRuleIds)); });
});
