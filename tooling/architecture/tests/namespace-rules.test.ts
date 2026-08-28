import { describe, expect, it } from 'vitest';
import { invalidNamespaceFixtures, validNamespaceFixtures } from '../fixtures/namespace-cases.js';
import { analyzeArchitecture } from '../src/index.js';
import { withFixture } from './test-workspace.js';

describe('namespace surfaces and system Query graph', () => {
  for (const fixture of validNamespaceFixtures) it(`accepts ${fixture.name}`, async () => { await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations).toEqual([])); });
  for (const fixture of invalidNamespaceFixtures) it(`rejects ${fixture.name}`, async () => { await withFixture(fixture, async (rootDir) => expect((await analyzeArchitecture(rootDir)).violations.map((current) => current.ruleId)).toEqual(fixture.expectedRuleIds)); });
});
