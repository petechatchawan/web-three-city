import { describe, expect, it } from 'vitest';
import type { InteractionEvidence } from './interaction-evidence.js';
import {
  pointerReleaseTransaction,
  undoTransaction,
} from './game-transaction-presentation.js';

function evidence(
  terraform: Readonly<{ strokeActive: boolean; acceptedStampCount: number }>,
  road: Readonly<{
    strokeActive: boolean;
    previewValid: boolean | null;
    undoKind: 'terraform' | 'road' | null;
  }>,
): InteractionEvidence {
  return {
    terraform,
    road,
  } as unknown as InteractionEvidence;
}

describe('game transaction presentation ownership', () => {
  it('announces an accepted Terraform release even when the current stamp is rejected', () => {
    expect(
      pointerReleaseTransaction(
        evidence(
          { strokeActive: true, acceptedStampCount: 2 },
          { strokeActive: false, previewValid: null, undoKind: null },
        ),
      ),
    ).toEqual({ state: 'committing', domain: 'terraform' });
  });

  it('announces only valid Road releases', () => {
    expect(
      pointerReleaseTransaction(
        evidence(
          { strokeActive: false, acceptedStampCount: 0 },
          { strokeActive: true, previewValid: true, undoKind: null },
        ),
      ),
    ).toEqual({ state: 'committing', domain: 'road' });
    expect(
      pointerReleaseTransaction(
        evidence(
          { strokeActive: false, acceptedStampCount: 0 },
          { strokeActive: true, previewValid: false, undoKind: null },
        ),
      ),
    ).toBeNull();
  });

  it('does not announce no-change or idle pointer releases', () => {
    expect(
      pointerReleaseTransaction(
        evidence(
          { strokeActive: true, acceptedStampCount: 0 },
          { strokeActive: false, previewValid: null, undoKind: null },
        ),
      ),
    ).toBeNull();
    expect(pointerReleaseTransaction(undefined)).toBeNull();
  });

  it('derives Undo ownership from the tagged world Undo entry', () => {
    expect(
      undoTransaction(
        evidence(
          { strokeActive: false, acceptedStampCount: 0 },
          { strokeActive: false, previewValid: null, undoKind: 'road' },
        ),
      ),
    ).toEqual({ state: 'undoing', domain: 'road' });
    expect(undoTransaction(undefined)).toBeNull();
  });
});
