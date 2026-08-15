import { describe, expect, it } from 'vitest';
import {
  localizeInspectFieldLabel,
  localizeInspectTitle,
  uiText,
} from './presentation-locale.js';

describe('Citizen / Traffic presentation locale', () => {
  it('resolves required traffic copy in English and Thai through one catalog', () => {
    expect(uiText('en', 'informationViewTraffic')).toBe('Traffic');
    expect(uiText('th', 'informationViewTraffic')).toBe('การจราจร');
    expect(uiText('th', 'trafficCongested')).toBe('ติดขัด');
    expect(localizeInspectTitle('th', 'Citizen')).toBe('ประชาชน');
    expect(localizeInspectTitle('th', 'Vehicle')).toBe('รถยนต์');
    expect(localizeInspectFieldLabel('th', 'Destination')).toBe('ปลายทาง');
    expect(localizeInspectFieldLabel('th', 'Congestion')).toBe('ความหนาแน่นจราจร');
  });

  it('leaves unknown domain values untouched rather than inventing authority copy', () => {
    expect(localizeInspectFieldLabel('th', 'Custom future field')).toBe('Custom future field');
    expect(localizeInspectTitle('th', 'Residential Cottage')).toBe('Residential Cottage');
  });
});
