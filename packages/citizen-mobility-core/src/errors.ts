export type MobilityContractErrorCode =
  | 'mobility:invalid-id'
  | 'mobility:invalid-time'
  | 'mobility:invalid-state'
  | 'mobility:invalid-trip'
  | 'mobility:invalid-sequence'
  | 'mobility:duplicate-citizen'
  | 'mobility:duplicate-trip'
  | 'mobility:travel-without-active-trip'
  | 'mobility:stationary-with-active-trip'
  | 'mobility:missing-stationary-building'
  | 'mobility:missing-active-trip'
  | 'mobility:active-trip-citizen-mismatch';

export class MobilityContractError extends Error {
  readonly code: MobilityContractErrorCode;

  constructor(code: MobilityContractErrorCode) {
    super(code);
    this.name = 'MobilityContractError';
    this.code = code;
  }
}
