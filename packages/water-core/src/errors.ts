export type WaterErrorCode =
  | 'water:invalid-terrain-dimensions'
  | 'water:invalid-height-lattice'
  | 'water:invalid-terrain-revision'
  | 'water:invalid-sea-level'
  | 'water:terrain-revision-mismatch'
  | 'water:not-loaded'
  | 'water:disposed';

export interface WaterError {
  readonly code: WaterErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class WaterContractError extends Error {
  readonly code: WaterErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(error: WaterError) {
    super(error.code);
    this.name = 'WaterContractError';
    this.code = error.code;
    if (error.details !== undefined) this.details = error.details;
  }
}
