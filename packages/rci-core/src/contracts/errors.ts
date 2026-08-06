export type RciContractErrorCode =
  | 'rci:invalid-state'
  | 'rci:invalid-plan'
  | 'rci:stale-rci-plan'
  | 'rci:stale-simulation-plan'
  | 'rci:stale-building-plan'
  | 'rci:unknown-definition'
  | 'rci:sequence-overflow'
  | 'rci:dangling-citizen'
  | 'rci:dangling-household'
  | 'rci:dangling-building'
  | 'rci:duplicate-active-membership'
  | 'rci:duplicate-active-partner'
  | 'rci:duplicate-active-housing'
  | 'rci:duplicate-active-employment'
  | 'rci:capacity-exceeded'
  | 'rci:invalid-relationship'
  | 'rci:invalid-queue'
  | 'rci:invalid-demand'
  | 'rci:incoherent-world-revision';

export class RciContractError extends Error {
  readonly code: RciContractErrorCode;

  constructor(code: RciContractErrorCode) {
    super(code);
    this.name = 'RciContractError';
    this.code = code;
  }
}
