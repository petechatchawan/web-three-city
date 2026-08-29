import type {
  CreateInitialWorldInput,
  WorldConstructionResult,
  WorldSystem,
} from "../contracts/world-read";
import { createMapState } from "../application/create-map-state";

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
