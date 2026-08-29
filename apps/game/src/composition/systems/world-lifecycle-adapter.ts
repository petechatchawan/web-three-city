import type {
  LifecyclePortResult,
  WorldLifecyclePort,
} from "@web-three-city/orchestration-city-session";
import type { WorldConstructionResult } from "@web-three-city/world";
import {
  createInitialWorldSystem,
  prepareProductionWorldDefinition,
  restoreWorldSystem,
} from "@web-three-city/world/composition";

function adapt<T>(result: WorldConstructionResult<T>): LifecyclePortResult<T> {
  return result.status === "success"
    ? result
    : Object.freeze({
        status: "rejected",
        code: result.code,
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      });
}

export function createWorldLifecycleAdapter(): WorldLifecyclePort {
  const adapter: WorldLifecyclePort = {
    prepareDefinition() {
      return adapt(prepareProductionWorldDefinition());
    },
    createInitial(input) {
      return adapt(createInitialWorldSystem(input));
    },
    restore(snapshot) {
      const prepared = prepareProductionWorldDefinition();
      if (prepared.status !== "success") {
        return Object.freeze({
          status: "rejected",
          code: prepared.code,
          ...(prepared.detail === undefined ? {} : { detail: prepared.detail }),
        });
      }
      return adapt(restoreWorldSystem({ prepared: prepared.value, snapshot }));
    },
  };
  return Object.freeze(adapter);
}
