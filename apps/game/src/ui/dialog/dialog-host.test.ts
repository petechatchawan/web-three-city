import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDialogHost } from './dialog-host.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('DialogHost', () => {
  it('renders one blocking primary dialog and replaces it on open', () => {
    const host = mountDialogHost(document.body);
    host.open({ kind: 'system', key: 'city', title: 'City' }, (body) => {
      body.textContent = 'Overview';
    });
    host.open({ kind: 'inspect', key: 'terrain', title: 'Terrain' }, (body) => {
      body.textContent = 'Cell';
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(host.activeRoute).toEqual({ kind: 'inspect', key: 'terrain', title: 'Terrain' });
    expect(host.element.hasAttribute('data-world-input-block')).toBe(true);
  });

  it('backs through internal routes before closing the root', () => {
    const host = mountDialogHost(document.body);
    host.open({ kind: 'system', key: 'city', title: 'City' }, () => undefined);
    host.push({ kind: 'system', key: 'economy', title: 'Economy' }, () => undefined);
    host.back();
    expect(host.activeRoute?.key).toBe('city');
    host.back();
    expect(host.activeRoute).toBeNull();
  });

  it('presents the primary dialog as a 90vh bottom sheet, not a centered modal', () => {
    const host = mountDialogHost(document.body);
    host.open({ kind: 'system', key: 'city', title: 'City' }, () => undefined);
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(sheet.classList.contains('city-dialog')).toBe(false);
    expect(sheet.classList.contains('city-sheet')).toBe(true);
    expect(sheet.dataset.sheet).toBe('90vh');
    expect(sheet.style.height > '90vh').toBe(false);
    expect(sheet.querySelector('.city-sheet-handle')).not.toBeNull();
    expect(sheet.querySelector('.city-sheet-body')).not.toBeNull();
  });

  it('closes on a backdrop tap but stays open when the sheet itself is clicked', () => {
    const host = mountDialogHost(document.body);
    host.open({ kind: 'system', key: 'city', title: 'City' }, () => undefined);
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]')!;
    sheet.click();
    expect(host.activeRoute).not.toBeNull();
    host.element.click();
    expect(host.activeRoute).toBeNull();
  });

  it('re-renders only live routes on update, keeping static dialogs stable', () => {
    const host = mountDialogHost(document.body);
    let liveRenderCount = 0;
    let staticRenderCount = 0;
    host.open({ kind: 'system', key: 'city', title: 'City', live: true }, () => {
      liveRenderCount += 1;
    });
    const body = host.element.querySelector<HTMLElement>('.city-sheet-body')!;
    const marker = document.createElement('span');
    marker.id = 'live-marker';
    body.append(marker);
    host.update();
    expect(liveRenderCount).toBe(2);
    expect(body.querySelector('#live-marker')).toBeNull();
    host.close();
    host.open({ kind: 'system', key: 'game-menu', title: 'Game Menu' }, () => {
      staticRenderCount += 1;
    });
    const staticBody = host.element.querySelector<HTMLElement>('.city-sheet-body')!;
    const staticMarker = document.createElement('span');
    staticMarker.id = 'static-marker';
    staticBody.append(staticMarker);
    host.update();
    expect(staticRenderCount).toBe(1);
    expect(staticBody.querySelector('#static-marker')).not.toBeNull();
  });

  it('refresh re-renders a static route and re-reads its current title', () => {
    const host = mountDialogHost(document.body);
    let renderCount = 0;
    host.open({ kind: 'system', key: 'info-views', title: 'Information Views' }, () => {
      renderCount += 1;
    });
    host.refresh();
    expect(renderCount).toBe(2);
  });

  it('closes on Escape, restores focus, and dispose removes owned DOM', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const host = mountDialogHost(document.body);
    host.open({ kind: 'system', key: 'city', title: 'City' }, () => undefined);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.activeRoute).toBeNull();
    expect(document.activeElement).toBe(trigger);
    const removeSpy = vi.spyOn(host.element, 'remove');
    host.dispose();
    expect(removeSpy).toHaveBeenCalledOnce();
  });
});
