export type WorldContractErrorCode =
  | 'world:invalid-cell-coordinate'
  | 'world:invalid-vertex-coordinate'
  | 'world:outside-map';

export class WorldContractError extends Error {
  readonly code: WorldContractErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: WorldContractErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(code);
    this.name = 'WorldContractError';
    this.code = code;
    this.details = details;
  }
}
