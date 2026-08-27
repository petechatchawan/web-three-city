import type { AbsoluteGameMinute, MacroHourIndex } from './temporal-units.js';

export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'faster';

export interface SimulationSnapshot {
  readonly revision: number;
  readonly absoluteGameMinute: AbsoluteGameMinute;
  readonly growthSequence: number;
}

export interface SimulationSnapshotInput {
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}

export interface MacroHourTransition {
  readonly beforeAbsoluteGameMinute: AbsoluteGameMinute;
  readonly afterAbsoluteGameMinute: AbsoluteGameMinute;
  readonly beforeMacroHourIndex: MacroHourIndex;
  readonly afterMacroHourIndex: MacroHourIndex;
  readonly crossed: boolean;
}

export interface GameCalendar {
  readonly year: number;
  readonly month: number;
  readonly hour: number;
  readonly minute: number;
}

export interface SimulationMinutePlan {
  readonly baseRevision: number;
  readonly beforeAbsoluteGameMinute: AbsoluteGameMinute;
  readonly afterAbsoluteGameMinute: AbsoluteGameMinute;
  readonly valid: boolean;
  readonly invalidReason: 'simulation:invalid-state' | 'simulation:minute-overflow' | null;
}

export interface SimulationMinuteReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly beforeAbsoluteGameMinute: AbsoluteGameMinute;
  readonly afterAbsoluteGameMinute: AbsoluteGameMinute;
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
