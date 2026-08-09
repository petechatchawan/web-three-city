import { describe, expect, it, vi } from 'vitest';
import { createInformationViewRegistry } from './information-view-registry.js';

describe('information view registry', () => {
  it('activates, replaces, and deactivates exactly one primary view', () => {
    const gridDeactivate = vi.fn();
    const zoningDeactivate = vi.fn();
    const registry = createInformationViewRegistry([
      {
        key: 'grid',
        title: 'Canonical Grid',
        legend: 'Buildable cells',
        activate: vi.fn(),
        deactivate: gridDeactivate,
      },
      {
        key: 'zoning',
        title: 'Zoning',
        legend: 'R/C/I',
        activate: vi.fn(),
        deactivate: zoningDeactivate,
      },
    ]);
    registry.activate('grid');
    registry.replace('zoning');
    expect(gridDeactivate).toHaveBeenCalledOnce();
    expect(registry.projection()?.title).toBe('Zoning');
    registry.deactivate();
    registry.deactivate();
    expect(zoningDeactivate).toHaveBeenCalledOnce();
    expect(registry.projection()).toBeNull();
  });
});
