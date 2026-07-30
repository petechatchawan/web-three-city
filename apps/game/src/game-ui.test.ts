// @vitest-environment happy-dom

import type { TerraformPlan } from '@web-three-city/terrain-core';
import { describe, expect, it } from 'vitest';
import type { GameToolPresentationState } from './game-tool-presentation.js';
import { renderGameUi } from './game-ui.js';

const EMPTY_PLAN = Object.freeze({
  affectedCells: Object.freeze([]),
  supportCells: Object.freeze([]),
}) as unknown as TerraformPlan;

function terraformContextFixture(): GameToolPresentationState {
  return Object.freeze({
    mode: 'raise',
    storedTerraformBrush: 3,
    interaction: Object.freeze({
      kind: 'terraform',
      state: Object.freeze({
        operation: 'raise',
        brushSize: 3,
        strokeActive: true,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([{ x: 1, z: 1 }]),
        acceptedPlan: EMPTY_PLAN,
        currentStamp: Object.freeze({
          kind: 'rejected',
          anchor: Object.freeze({ x: 2, z: 1 }),
          reason: 'terraform:road-occupied',
          preview: Object.freeze({
            corePlan: EMPTY_PLAN,
            previewPlan: EMPTY_PLAN,
            valid: false,
            invalidReason: 'terraform:road-occupied',
            blockedRoadCells: Object.freeze([{ x: 2, z: 1 }]),
          }),
        }),
      }),
    }),
    undoAvailable: true,
    primaryMessage: null,
  });
}

describe('renderGameUi', () => {
  it('separates primary tools, context, Undo, and secondary controls', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);

    expect(root.querySelector('[data-testid="primary-world-tools"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tool-context"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="undo-world-change"]')).toBe(ui.undoButton);
    expect(root.querySelector('[data-testid="secondary-controls"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tool-close"]')).toBe(ui.closeToolButton);
  });

  it('renders actionable Terraform context without revisions or hashes', () => {
    const root = document.createElement('div');
    const ui = renderGameUi(root);

    ui.renderToolPresentation(terraformContextFixture());

    expect(root.querySelector('[data-testid="tool-context-message"]')?.textContent).toBe(
      'Remove the road before changing this terrain',
    );
    expect(root.querySelector('[data-testid="terraform-accepted-count"]')?.textContent).toBe('1');
    expect(root.querySelector('[data-testid="terraform-support-count"]')?.textContent).toBe('0');
    expect(root.textContent).not.toMatch(/revision|hash|chunk/i);
  });

  it('keeps stable accessible names for persistence and Undo actions', () => {
    const root = document.createElement('div');
    renderGameUi(root);

    expect(root.querySelector('[aria-label="Undo latest world change"]')).not.toBeNull();
    expect([...root.querySelectorAll('button')].some((button) => button.textContent === 'Save world')).toBe(
      true,
    );
    expect([...root.querySelectorAll('button')].some((button) => button.textContent === 'Load world')).toBe(
      true,
    );
  });
});
