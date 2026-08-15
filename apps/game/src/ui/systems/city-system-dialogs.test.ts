import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApplicationFixture } from '../../../test/application-fixtures.js';
import { mountDialogHost } from '../dialog/dialog-host.js';
import { createCitySystemDialogs } from './city-system-dialogs.js';

afterEach(() => document.body.replaceChildren());

describe('City system dialogs', () => {
  it('keeps authoritative City systems and exposes secondary mobile management entries', () => {
    const world = createApplicationFixture();
    const host = mountDialogHost(document.body);
    const dialogs = createCitySystemDialogs(host, {
      getWorld: () => world,
      rciRegistries: createFoundationRciRegistries(),
      submitTaxPolicy: vi.fn(() => ({ status: 'accepted' as const })),
    });
    dialogs.openCity();
    expect(host.element.textContent).toContain('City Overview');
    expect(host.element.textContent).toContain('Population / RCI');
    expect(host.element.textContent).toContain('Information Views');
    expect(host.element.textContent).toContain('Game Menu');
    expect(host.element.textContent).not.toContain('Loans');
    expect(host.element.querySelector('.city-kpi-grid')).not.toBeNull();
    expect(host.element.querySelectorAll('.city-kpi-card')).toHaveLength(3);
    expect(host.element.querySelector('.city-detail-card')).not.toBeNull();
    expect(host.element.querySelector('.city-system-grid')).not.toBeNull();
    expect(host.element.querySelector('[data-management="information-views"]')).not.toBeNull();
    expect(host.element.querySelector('[data-management="game-menu"]')).not.toBeNull();
    host.element.querySelector<HTMLButtonElement>('[data-system="economy"]')?.click();
    expect(host.element.textContent).toContain('Treasury');
    expect(host.element.textContent).toContain('Road maintenance');
  });

  it('submits a typed tax policy and reports bounded status', () => {
    const submitTaxPolicy = vi.fn(() => ({ status: 'accepted' as const }));
    const host = mountDialogHost(document.body);
    const dialogs = createCitySystemDialogs(host, {
      getWorld: createApplicationFixture,
      rciRegistries: createFoundationRciRegistries(),
      submitTaxPolicy,
    });
    dialogs.openEconomyTaxation();
    host.element.querySelector<HTMLSelectElement>('[data-testid="tax-residential"]')!.value = '8';
    host.element.querySelector<HTMLButtonElement>('[data-testid="apply-tax-policy"]')?.click();
    expect(submitTaxPolicy).toHaveBeenCalledWith({
      residentialBp: 800,
      commercialBp: 700,
      industrialBp: 700,
    });
    expect(host.element.querySelector('[role="status"]')?.textContent).toBe('Tax policy updated');
  });
});
