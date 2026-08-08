import {
  createFoundationRciRegistries,
  createRciMigrationInventory,
  decodeRciSaveV1,
  encodeRciSaveV1,
  type RciSaveV1,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import {
  createInitialEconomySnapshot,
  decodeEconomySaveV1,
  encodeEconomySaveV1,
  FOUNDATION_ECONOMY_RULES,
  type EconomySaveV1,
  type EconomySnapshotV1,
} from '@web-three-city/economy-core';
import {
  decodeSimulationSaveV2,
  deriveGameCalendar,
  encodeSimulationSaveV1,
  encodeSimulationSaveV2,
  type SimulationSaveV2,
} from '@web-three-city/simulation-core';
import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import * as legacy from './world-save-legacy.js';

export {
  encodeWorldSaveV1,
  encodeWorldSaveV2,
  encodeWorldSaveV3,
  encodeWorldSaveV4,
} from './world-save-legacy.js';
export type { WorldSaveV1, WorldSaveV2, WorldSaveV3, WorldSaveV4 } from './world-save-legacy.js';

export interface WorldSaveV5 {
  readonly kind: 'world-save';
  readonly schemaVersion: 5;
  readonly terrain: legacy.WorldSaveV4['terrain'];
  readonly roads: legacy.WorldSaveV4['roads'];
  readonly zones: legacy.WorldSaveV4['zones'];
  readonly buildings: legacy.WorldSaveV4['buildings'];
  readonly simulation: legacy.WorldSaveV4['simulation'];
  readonly rci: RciSaveV1;
}

export interface WorldSaveV6 extends Omit<WorldSaveV5, 'schemaVersion' | 'simulation'> {
  readonly schemaVersion: 6;
  readonly simulation: SimulationSaveV2;
  readonly economy: EconomySaveV1;
}

export interface DecodedWorldState extends legacy.DecodedWorldState {
  readonly rci: RciSnapshot;
  readonly economy: EconomySnapshotV1;
}

export type WorldSaveErrorCode =
  legacy.WorldSaveErrorCode | 'world-save:invalid-rci' | 'world-save:invalid-economy';
export interface WorldSaveError {
  readonly code: WorldSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeWorldSaveV5(
  terrain: Parameters<typeof legacy.encodeWorldSaveV4>[0],
  roads: Parameters<typeof legacy.encodeWorldSaveV4>[1],
  zones: Parameters<typeof legacy.encodeWorldSaveV4>[2],
  buildings: Parameters<typeof legacy.encodeWorldSaveV4>[3],
  simulation: Parameters<typeof legacy.encodeWorldSaveV4>[4],
  rci: RciSnapshot,
): WorldSaveV5 {
  const base = legacy.encodeWorldSaveV4(terrain, roads, zones, buildings, simulation);
  return Object.freeze({ ...base, schemaVersion: 5, rci: encodeRciSaveV1(rci) });
}

export function encodeWorldSaveV6(
  terrain: Parameters<typeof encodeWorldSaveV5>[0],
  roads: Parameters<typeof encodeWorldSaveV5>[1],
  zones: Parameters<typeof encodeWorldSaveV5>[2],
  buildings: Parameters<typeof encodeWorldSaveV5>[3],
  simulation: Parameters<typeof encodeWorldSaveV5>[4],
  rci: RciSnapshot,
  economy: EconomySnapshotV1,
): WorldSaveV6 {
  return Object.freeze({
    ...encodeWorldSaveV5(terrain, roads, zones, buildings, simulation, rci),
    schemaVersion: 6,
    simulation: encodeSimulationSaveV2(simulation),
    economy: encodeEconomySaveV1(economy),
  });
}

function migratedEconomy(simulation: legacy.DecodedWorldState['simulation']): EconomySnapshotV1 {
  const calendar = deriveGameCalendar(simulation.absoluteTick);
  const dayStart = simulation.absoluteTick - calendar.hour;
  const latestBoundary = Math.max(0, calendar.hour >= 8 ? dayStart + 8 : dayStart - 16);
  return createInitialEconomySnapshot(
    { year: calendar.year, month: calendar.month, latestDailySettlementTick: latestBoundary },
    FOUNDATION_ECONOMY_RULES,
  );
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  const isV6 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 6;
  const isV5 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 5;
  const decodedV6Simulation =
    isV6 && 'simulation' in input ? decodeSimulationSaveV2(input.simulation) : null;
  if (decodedV6Simulation && !decodedV6Simulation.ok) {
    return err({ code: 'world-save:invalid-simulation' });
  }
  const legacyInput =
    isV6 || isV5
      ? Object.freeze({
          ...input,
          schemaVersion: 4,
          ...(decodedV6Simulation?.ok
            ? { simulation: encodeSimulationSaveV1(decodedV6Simulation.value) }
            : {}),
        })
      : input;
  const base = legacy.decodeWorldSave(legacyInput, config);
  if (!base.ok) return base;

  const registries = createFoundationRciRegistries();
  if (!isV6 && !isV5) {
    return ok(
      Object.freeze({
        ...base.value,
        rci: createRciMigrationInventory({
          buildings: base.value.buildings,
          absoluteTick: base.value.simulation.absoluteTick,
          registries,
        }),
        economy: migratedEconomy(base.value.simulation),
      }),
    );
  }

  if (!('rci' in input)) return err({ code: 'world-save:invalid-schema' });
  const decodedRci = decodeRciSaveV1(input.rci, {
    buildings: base.value.buildings,
    simulation: base.value.simulation,
    registries,
  });
  if (!decodedRci.ok) {
    return err({
      code: 'world-save:invalid-rci',
      details: Object.freeze({ rciCode: decodedRci.error.code }),
    });
  }

  if (!isV6) {
    return ok(
      Object.freeze({
        ...base.value,
        rci: decodedRci.value,
        economy: migratedEconomy(base.value.simulation),
      }),
    );
  }
  if (!('economy' in input)) return err({ code: 'world-save:invalid-schema' });
  const decodedEconomy = decodeEconomySaveV1(input.economy, FOUNDATION_ECONOMY_RULES);
  if (!decodedEconomy.ok) return err({ code: 'world-save:invalid-economy' });
  return ok(
    Object.freeze({
      ...base.value,
      simulation: decodedV6Simulation?.ok ? decodedV6Simulation.value : base.value.simulation,
      rci: decodedRci.value,
      economy: decodedEconomy.value,
    }),
  );
}
