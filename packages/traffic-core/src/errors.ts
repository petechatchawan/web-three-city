export type TrafficContractErrorCode =
  | 'traffic:invalid-id'
  | 'traffic:invalid-state'
  | 'traffic:invalid-source'
  | 'traffic:invalid-graph'
  | 'traffic:duplicate-node'
  | 'traffic:duplicate-edge'
  | 'traffic:dangling-edge'
  | 'traffic:duplicate-trip'
  | 'traffic:invalid-trip'
  | 'traffic:unknown-road-profile'
  | 'traffic:invalid-road-profile';

export class TrafficContractError extends Error {
  readonly code: TrafficContractErrorCode;

  constructor(code: TrafficContractErrorCode) {
    super(code);
    this.name = 'TrafficContractError';
    this.code = code;
  }
}
