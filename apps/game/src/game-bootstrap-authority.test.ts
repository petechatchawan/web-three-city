import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');

function section(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`missing bootstrap section: ${start}`);
  return source.slice(from, to);
}

describe('game bootstrap authority migration', () => {
  it('does not own raw persistence or the legacy per-domain Undo store', () => {
    expect(source).not.toMatch(/encodeWorldSaveV5|decodeWorldSave|WorldUndoStore|WorldUndoEntry/);
    expect(source).toMatch(/SaveCoordinator/);
    expect(source).toMatch(/UndoCoordinator/);
  });

  it('routes every interactive mutation through committed-world publication', () => {
    expect(section('const applyTerraformPlan', 'const applyRoadPlan')).toMatch(
      /publishCommittedDomain/,
    );
    expect(section('const applyRoadPlan', 'const applyZonePlan')).toMatch(/publishCommittedDomain/);
    expect(section('const applyZonePlan', 'const commitBuildingBulldozePlan')).toMatch(
      /publishCommittedDomain/,
    );
    expect(
      section('const commitBuildingBulldozePlan', 'const applyBuildingBulldozeRequest'),
    ).toMatch(/publishCommittedDomain/);
  });

  it('routes foreground/background simulation mutation through committed-world publication', () => {
    expect(section('const runBackgroundGrowthTick', 'const runSimulationOnlyTick')).toMatch(
      /publishCommittedDomain/,
    );
    expect(section('const runSimulationOnlyTick', 'const resetCamera')).toMatch(
      /publishCommittedDomain/,
    );
  });
});
