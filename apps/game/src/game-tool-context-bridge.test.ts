import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchGameToolEvent } from './game-tool-events.js';
import { bindGameToolContext, translateToolEvent } from './game-tool-context-bridge.js';

afterEach(() => document.body.replaceChildren());

describe('translateToolEvent', () => {
  it('maps an accepted terraform stroke to a Valid preview projection', () => {
    const projection = translateToolEvent({
      type: 'terraform-state',
      state: {
        operation: 'raise',
        brushSize: 3,
        strokeActive: true,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([
          { x: 1, z: 1 },
          { x: 2, z: 1 },
        ]),
        acceptedPlan: Object.freeze({ supportCells: Object.freeze([{ x: 3, z: 1 }]) }) as never,
        currentStamp: Object.freeze({ kind: 'accepted', anchor: Object.freeze({ x: 1, z: 1 }) }),
      },
    });
    expect(projection).not.toBeNull();
    expect(projection!.mode).toBe('raise');
    expect(projection!.name).toBe('Raise');
    expect(projection!.state).toBe('Valid preview');
    expect(projection!.message).toBe('Release to apply the accepted terrain change');
    expect(projection!.requestedCells).toBe(2);
    expect(projection!.effectiveCells).toBe(1);
  });

  it('maps a rejected terraform stroke with the reason message', () => {
    const projection = translateToolEvent({
      type: 'terraform-state',
      state: {
        operation: 'lower',
        brushSize: 3,
        strokeActive: true,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([]),
        acceptedPlan: null,
        currentStamp: Object.freeze({
          kind: 'rejected',
          anchor: Object.freeze({ x: 4, z: 1 }),
          reason: 'terraform:road-occupied',
          preview: Object.freeze({}) as never,
        }),
      },
    });
    expect(projection!.state).toBe('Rejected');
    expect(projection!.message).toBe('Remove the road before changing this terrain');
    expect(projection!.requestedCells).toBe(0);
    expect(projection!.effectiveCells).toBe(0);
  });

  it('maps a previewing none-stamp stroke to Previewing', () => {
    const projection = translateToolEvent({
      type: 'terraform-state',
      state: {
        operation: 'raise',
        brushSize: 1,
        strokeActive: true,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([]),
        acceptedPlan: null,
        currentStamp: Object.freeze({ kind: 'none' }),
      },
    });
    expect(projection!.state).toBe('Previewing');
  });

  it('maps a road state through the shared label helper', () => {
    const projection = translateToolEvent({
      type: 'road-state',
      state: {
        mode: 'road-build',
        strokeActive: true,
        previewValid: true,
        previewCellCount: 4,
      },
      reason: null,
    });
    expect(projection!.state).toBe('Valid build');
    expect(projection!.message).toBe('Release to build the highlighted Road cells');
    expect(projection!.requestedCells).toBe(4);
    expect(projection!.effectiveCells).toBe(4);
  });

  it('maps an invalid road state with reason over the stroke message', () => {
    const projection = translateToolEvent({
      type: 'road-state',
      state: {
        mode: 'road-build',
        strokeActive: true,
        previewValid: false,
        previewCellCount: 4,
      },
      reason: 'road:wet-cell',
    });
    expect(projection!.state).toBe('Invalid build');
    expect(projection!.message).toBe('Roads cannot be placed on water');
    expect(projection!.effectiveCells).toBe(0);
  });

  it('maps a zone removal state through the shared label helper', () => {
    const projection = translateToolEvent({
      type: 'zone-state',
      state: {
        mode: 'zone-remove',
        strokeActive: true,
        previewValid: false,
        previewInvalidReason: null,
        previewCellCount: 5,
      },
      reason: null,
      effectiveCellCount: 5,
      invalidCellCount: 0,
    });
    expect(projection!.state).toBe('Invalid removal');
    expect(projection!.message).toBe('Release to remove the highlighted Zone cells');
    expect(projection!.requestedCells).toBe(5);
    expect(projection!.effectiveCells).toBe(5);
  });

  it('maps a committing transaction to Applying change with the domain label', () => {
    const projection = translateToolEvent({
      type: 'transaction-state',
      state: 'committing',
      domain: 'terraform',
    });
    expect(projection!.state).toBe('Applying change');
    expect(projection!.message).toBe('Applying Terrain change…');
    expect(projection!.requestedCells).toBeUndefined();
  });

  it('maps an undoing transaction to Undoing with the domain label', () => {
    const projection = translateToolEvent({
      type: 'transaction-state',
      state: 'undoing',
      domain: 'road',
    });
    expect(projection!.state).toBe('Undoing');
    expect(projection!.message).toBe('Restoring previous Road state…');
  });

  it('maps a no-change reason', () => {
    const projection = translateToolEvent({ type: 'reason', reason: 'terraform:no-change' });
    expect(projection!.state).toBe('No change');
    expect(projection!.message).toBe('No terrain change');
  });

  it('maps a rejected reason', () => {
    const projection = translateToolEvent({ type: 'reason', reason: 'terraform:road-occupied' });
    expect(projection!.state).toBe('Rejected');
  });

  it('returns null for an idle terraform stroke', () => {
    const projection = translateToolEvent({
      type: 'terraform-state',
      state: {
        operation: null,
        brushSize: 1,
        strokeActive: false,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([]),
        acceptedPlan: null,
        currentStamp: Object.freeze({ kind: 'none' }),
      },
    });
    expect(projection).toBeNull();
  });
});

describe('bindGameToolContext', () => {
  it('subscribes to committed tool events and forwards the folded projection', () => {
    const target = new EventTarget();
    const sheet = {
      update: vi.fn(),
      element: document.createElement('div'),
      dispose: vi.fn(),
    };
    const controller = new AbortController();
    bindGameToolContext(target, sheet, controller.signal);

    dispatchGameToolEvent(target, {
      type: 'terraform-state',
      state: {
        operation: 'raise',
        brushSize: 3,
        strokeActive: true,
        flattenTargetLevel: null,
        acceptedAnchors: Object.freeze([{ x: 1, z: 1 }]),
        acceptedPlan: Object.freeze({ supportCells: Object.freeze([{ x: 3, z: 1 }]) }) as never,
        currentStamp: Object.freeze({ kind: 'accepted', anchor: Object.freeze({ x: 1, z: 1 }) }),
      },
    });

    expect(sheet.update).toHaveBeenCalledTimes(1);
    const projection = sheet.update.mock.calls[0]![0];
    expect(projection.mode).toBe('raise');
    expect(projection.state).toBe('Valid preview');
    expect(projection.requestedCells).toBe(1);

    controller.abort();
    dispatchGameToolEvent(target, {
      type: 'transaction-state',
      state: 'committing',
      domain: 'road',
    });
    expect(sheet.update).toHaveBeenCalledTimes(1);
  });
});
