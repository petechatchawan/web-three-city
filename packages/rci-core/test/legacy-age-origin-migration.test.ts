import {
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { RciContractError, ageBandAtMacroHour, ageYearsAtMacroHour } from '../src/index.js';
import { migrateLegacyBornAtMacroHour } from '../src/migration/legacy-age-origin-migration.js';

describe('legacy age-origin migration', () => {
  it('keeps a newborn at the legacy cutover origin', () => {
    const currentMacroHour = macroHourIndex(0);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(0);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(0);
  });

  it('maps one exact legacy year to one exact calendar year', () => {
    const currentMacroHour = macroHourIndex(8_640);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(8_352);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(1);
  });

  it('preserves the fractional-year phase for five and a half legacy years', () => {
    const currentMacroHour = macroHourIndex(47_520);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(45_936);
    expect(macroHourValue(currentMacroHour) - macroHourValue(migratedBornAt)).toBe(1_584);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(5);
  });

  it.each([
    { legacyElapsed: 29, expectedNewElapsed: 0 },
    { legacyElapsed: 30, expectedNewElapsed: 1 },
  ])(
    'uses floor division for $legacyElapsed legacy elapsed macro-hours',
    ({ legacyElapsed, expectedNewElapsed }) => {
      const currentMacroHour = macroHourIndex(1_000);
      const migratedBornAt = migrateLegacyBornAtMacroHour({
        legacyBornAtMacroHour: 1_000 - legacyElapsed,
        currentMacroHour,
      });

      expect(macroHourValue(currentMacroHour) - macroHourValue(migratedBornAt)).toBe(
        expectedNewElapsed,
      );
    },
  );

  it.each([
    {
      transition: 6,
      position: 'transition-minus-one',
      legacyElapsed: 51_810,
      expectedNewElapsed: 1_727,
      expectedAgeYears: 5,
      expectedAgeBand: 'age-band.early-childhood',
    },
    {
      transition: 6,
      position: 'exact-transition',
      legacyElapsed: 51_840,
      expectedNewElapsed: 1_728,
      expectedAgeYears: 6,
      expectedAgeBand: 'age-band.school-age',
    },
    {
      transition: 6,
      position: 'transition-plus-one',
      legacyElapsed: 51_870,
      expectedNewElapsed: 1_729,
      expectedAgeYears: 6,
      expectedAgeBand: 'age-band.school-age',
    },
    {
      transition: 18,
      position: 'transition-minus-one',
      legacyElapsed: 155_490,
      expectedNewElapsed: 5_183,
      expectedAgeYears: 17,
      expectedAgeBand: 'age-band.school-age',
    },
    {
      transition: 18,
      position: 'exact-transition',
      legacyElapsed: 155_520,
      expectedNewElapsed: 5_184,
      expectedAgeYears: 18,
      expectedAgeBand: 'age-band.working-age',
    },
    {
      transition: 18,
      position: 'transition-plus-one',
      legacyElapsed: 155_550,
      expectedNewElapsed: 5_185,
      expectedAgeYears: 18,
      expectedAgeBand: 'age-band.working-age',
    },
    {
      transition: 65,
      position: 'transition-minus-one',
      legacyElapsed: 561_570,
      expectedNewElapsed: 18_719,
      expectedAgeYears: 64,
      expectedAgeBand: 'age-band.working-age',
    },
    {
      transition: 65,
      position: 'exact-transition',
      legacyElapsed: 561_600,
      expectedNewElapsed: 18_720,
      expectedAgeYears: 65,
      expectedAgeBand: 'age-band.senior',
    },
    {
      transition: 65,
      position: 'transition-plus-one',
      legacyElapsed: 561_630,
      expectedNewElapsed: 18_721,
      expectedAgeYears: 65,
      expectedAgeBand: 'age-band.senior',
    },
  ])(
    'preserves age and age band at the $transition-year $position',
    ({ legacyElapsed, expectedNewElapsed, expectedAgeYears, expectedAgeBand }) => {
      const currentMacroHour = macroHourIndex(legacyElapsed);
      const migratedBornAt = migrateLegacyBornAtMacroHour({
        legacyBornAtMacroHour: 0,
        currentMacroHour,
      });

      expect(macroHourValue(currentMacroHour) - macroHourValue(migratedBornAt)).toBe(
        expectedNewElapsed,
      );
      expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(expectedAgeYears);
      expect(ageBandAtMacroHour(migratedBornAt, currentMacroHour)).toBe(expectedAgeBand);
    },
  );

  it('maps eighteen exact legacy years to working age', () => {
    const currentMacroHour = macroHourIndex(155_520);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(150_336);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(18);
    expect(ageBandAtMacroHour(migratedBornAt, currentMacroHour)).toBe('age-band.working-age');
  });

  it('preserves the senior age-band boundary', () => {
    const currentMacroHour = macroHourIndex(561_600);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(542_880);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(65);
    expect(ageBandAtMacroHour(migratedBornAt, currentMacroHour)).toBe('age-band.senior');
  });

  it('keeps a birth at the current macro-hour unchanged', () => {
    const currentMacroHour = macroHourIndex(12_345);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 12_345,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(12_345);
    expect(ageYearsAtMacroHour(migratedBornAt, currentMacroHour)).toBe(0);
  });

  it('keeps the maximum representable current macro-hour result exact', () => {
    const currentMacroHour = macroHourIndex(Number.MAX_SAFE_INTEGER);

    const migratedBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });

    expect(macroHourValue(migratedBornAt)).toBe(8_706_959_279_582_958);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or unsafe legacy birth %s',
    (legacyBornAtMacroHour) => {
      expect(() =>
        migrateLegacyBornAtMacroHour({
          legacyBornAtMacroHour,
          currentMacroHour: macroHourIndex(0),
        }),
      ).toThrowError(new RciContractError('rci:invalid-state'));
    },
  );

  it('rejects a future legacy birth', () => {
    expect(() =>
      migrateLegacyBornAtMacroHour({
        legacyBornAtMacroHour: 101,
        currentMacroHour: macroHourIndex(100),
      }),
    ).toThrowError(new RciContractError('rci:invalid-state'));
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid or unsafe current macro-hour scalar %s',
    (currentMacroHour) => {
      expect(() =>
        migrateLegacyBornAtMacroHour({
          legacyBornAtMacroHour: 0,
          currentMacroHour: currentMacroHour as unknown as MacroHourIndex,
        }),
      ).toThrowError(new RciContractError('rci:invalid-state'));
    },
  );

  it('preserves the ordering of older and younger citizens', () => {
    const currentMacroHour = macroHourIndex(8_640);
    const olderBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 0,
      currentMacroHour,
    });
    const youngerBornAt = migrateLegacyBornAtMacroHour({
      legacyBornAtMacroHour: 8_640,
      currentMacroHour,
    });

    expect(macroHourValue(olderBornAt)).toBeLessThan(macroHourValue(youngerBornAt));
    expect(ageYearsAtMacroHour(olderBornAt, currentMacroHour)).toBeGreaterThanOrEqual(
      ageYearsAtMacroHour(youngerBornAt, currentMacroHour),
    );
  });
});
