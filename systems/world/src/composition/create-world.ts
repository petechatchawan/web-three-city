import type {
  CreateInitialWorldInput,
  RestoreWorldInput,
  WorldConstructionResult,
  WorldSystem,
} from "../contracts/world-read";
import { createMapState } from "../application/create-map-state";
import { restoreMapState } from "../application/restore-map-state";

export function createWorldInternal(
  input: CreateInitialWorldInput,
): WorldConstructionResult<WorldSystem> {
  const mapState = createMapState(input);
  if (mapState.status === "rejected") {
    return mapState;
  }

  const value: WorldSystem = Object.freeze({
    definition: input.prepared,
    spatial: input.prepared.spatial,
    mapState: mapState.value.read,
    captureSnapshot: mapState.value.captureSnapshot,
  });

  return { status: "success", value };
}

export function restoreWorldInternal(
  input: RestoreWorldInput,
): WorldConstructionResult<WorldSystem> {
  const mapState = restoreMapState(input);
  if (mapState.status === "rejected") return mapState;

  return {
    status: "success",
    value: Object.freeze({
      definition: input.prepared,
      spatial: input.prepared.spatial,
      mapState: mapState.value.read,
      captureSnapshot: mapState.value.captureSnapshot,
    }),
  };
}
