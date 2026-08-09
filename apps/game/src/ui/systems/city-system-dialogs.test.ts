import { createFoundationRciRegistries } from '@web-three-city/rci-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApplicationFixture } from '../../../test/application-fixtures.js';
import { mountDialogHost } from '../dialog/dialog-host.js';
import { createCitySystemDialogs } from './city-system-dialogs.js';

afterEach(() => document.body.replaceChildren());

describe('City system dialogs', () => {
  it('renders only authoritative system entries and Economy details', () => {
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
    expect(host.element.textContent).not.toContain('Loans');
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
