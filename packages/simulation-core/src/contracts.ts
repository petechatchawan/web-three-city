export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'faster';

export interface SimulationSnapshot {
  readonly revision: number;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}

export interface GameCalendar {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

export interface SimulationTickPlan {
  readonly baseRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly valid: boolean;
  readonly invalidReason: 'simulation:invalid-state' | 'simulation:tick-overflow' | null;
}

export interface SimulationTickReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
}

export type SimulationContractErrorCode = 'simulation:invalid-plan' | 'simulation:stale-plan';

export class SimulationContractError extends Error {
  readonly code: SimulationContractErrorCode;

  constructor(code: SimulationContractErrorCode) {
    super(code);
    this.name = 'SimulationContractError';
    this.code = code;
  }
}
