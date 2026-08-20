export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'faster';

export interface SimulationSnapshot {
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}

export interface MacroHourTransition {
  readonly beforeAbsoluteGameMinute: number;
  readonly afterAbsoluteGameMinute: number;
  readonly beforeMacroHourIndex: number;
  readonly afterMacroHourIndex: number;
  readonly crossed: boolean;
}

export interface GameCalendar {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

export interface SimulationMinutePlan {
  readonly baseRevision: number;
  readonly beforeAbsoluteGameMinute: number;
  readonly afterAbsoluteGameMinute: number;
  readonly valid: boolean;
  readonly invalidReason: 'simulation:invalid-state' | 'simulation:minute-overflow' | null;
}

export interface SimulationMinuteReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly beforeAbsoluteGameMinute: number;
  readonly afterAbsoluteGameMinute: number;
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
