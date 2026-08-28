import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { checkArchitecture } from '../src/index';
import type { FixtureCase } from './fixture-loader';
import { materializeFixture } from './fixture-loader';

async function loadCases(kind: 'valid' | 'invalid'): Promise<FixtureCase[]> {
  const file = path.resolve(import.meta.dirname, `../fixtures/${kind}/cases.json`);
  return JSON.parse(await readFile(file, 'utf8')) as FixtureCase[];
}

const validCases = await loadCases('valid');
const invalidCases = await loadCases('invalid');

describe('architecture checker fixtures', () => {
  for (const fixture of validCases) {
    test(`accepts ${fixture.name}`, async () => {
      const root = await materializeFixture(fixture.scenario);
      const report = await checkArchitecture(root);
      expect(report.violations).toEqual([]);
    });
  }

  for (const fixture of invalidCases) {
    test(`rejects ${fixture.name}`, async () => {
      const root = await materializeFixture(fixture.scenario);
      const report = await checkArchitecture(root);
      const ids = report.violations.map((violation) => violation.ruleId);
      expect(ids).toEqual(expect.arrayContaining(fixture.expectedRuleIds ?? []));
    });
  }

  test('returns deterministic ordering', async () => {
    const root = await materializeFixture('system-query-cycle');
    const first = await checkArchitecture(root);
    const second = await checkArchitecture(root);
    expect(second).toEqual(first);
  });
});
