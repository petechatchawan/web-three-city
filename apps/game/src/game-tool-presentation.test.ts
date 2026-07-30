import { describe, expect, it } from 'vitest';
import {
  initialGameToolPresentationState,
  reduceGameToolPresentation,
  type GameToolPresentationState,
} from './game-tool-presentation.js';

function terraformPreviewingState(): GameToolPresentationState {
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
        acceptedPlan: null,
        currentStamp: Object.freeze({ kind: 'accepted', anchor: { x: 1, z: 1 } }),
      }),
    }),
    undoAvailable: true,
    primaryMessage: null,
  });
}

describe('Game tool presentation reducer', () => {
  it('preserves the stored Terraform brush while switching through Road mode', () => {
    let state = initialGameToolPresentationState();
    state = reduceGameToolPresentation(state, { type: 'select-brush', size: 5 });
    state = reduceGameToolPresentation(state, { type: 'select-tool', mode: 'road-build' });
    state = reduceGameToolPresentation(state, { type: 'select-tool', mode: 'raise' });

    expect(state.storedTerraformBrush).toBe(5);
    expect(state.mode).toBe('raise');
  });

  it('Close Tool returns to Navigate and clears transient interaction', () => {
    const state = reduceGameToolPresentation(terraformPreviewingState(), {
      type: 'close-tool',
    });

    expect(state.mode).toBe('navigate');
    expect(state.interaction).toEqual({ kind: 'idle' });
    expect(state.storedTerraformBrush).toBe(3);
  });

  it('stores an immutable Terraform interaction update', () => {
    const fixture = terraformPreviewingState();
    const state = reduceGameToolPresentation(initialGameToolPresentationState(), {
      type: 'terraform-state',
      state: fixture.interaction.kind === 'terraform' ? fixture.interaction.state : neverState(),
    });

    expect(state.interaction).toEqual(fixture.interaction);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.interaction)).toBe(true);
  });

  it('disables Undo presentation during committing and undoing states', () => {
    const available = reduceGameToolPresentation(initialGameToolPresentationState(), {
      type: 'set-undo-available',
      available: true,
    });
    const committing = reduceGameToolPresentation(available, {
      type: 'set-committing',
      domain: 'terraform',
    });
    const undoing = reduceGameToolPresentation(available, { type: 'set-undoing' });

    expect(committing.undoAvailable).toBe(false);
    expect(undoing.undoAvailable).toBe(false);
  });
});

function neverState(): never {
  throw new Error('unreachable fixture');
}
