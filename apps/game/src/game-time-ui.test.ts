import { describe, expect, it, vi } from 'vitest';
import { mountGameTimeUi } from './game-time-ui.js';

describe('Game time UI', () => {
  it('renders accessible speeds, Step policy, calendar, and lifecycle counts', () => {
    document.body.innerHTML = '<main><section class="game-hud"><details class="secondary-controls"></details></section></main>';
    const onSpeed = vi.fn();
    const onStep = vi.fn();
    const ui = mountGameTimeUi(document.body, onSpeed, onStep);
    ui.update('paused', {
      calendarLabel: 'Y1 M1 D2 06:00',
      constructionCount: 2,
      activeCount: 3,
      totalCount: 5,
    });
    expect(ui.pauseButton.getAttribute('aria-pressed')).toBe('true');
    expect(ui.stepButton.disabled).toBe(false);
    expect(document.querySelector('[data-testid="game-calendar"]')?.textContent).toBe('Y1 M1 D2 06:00');
    ui.playButton.click();
    expect(onSpeed).toHaveBeenCalledWith('normal');
    ui.stepButton.click();
    expect(onStep).toHaveBeenCalledTimes(1);
    ui.dispose();
  });
});
