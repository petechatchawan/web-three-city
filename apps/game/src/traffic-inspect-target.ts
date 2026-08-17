import type { Object3D } from 'three';
import type { CitizenInspectTarget, VehicleInspectTarget } from './ui/inspect/inspect-target.js';

export type TrafficInspectTarget = CitizenInspectTarget | VehicleInspectTarget;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function trafficInspectTargetFromObject(
  object: Object3D | null,
): TrafficInspectTarget | null {
  let current: Object3D | null = object;
  while (current !== null) {
    const kind = current.userData.trafficAgentKind;
    const citizenId = current.userData.citizenId;
    const tripId = current.userData.tripId;
    if (kind === 'citizen' && validId(citizenId)) {
      return Object.freeze({
        kind: 'citizen',
        citizenId,
        tripId: validId(tripId) ? tripId : null,
      });
    }
    if (kind === 'vehicle' && validId(citizenId) && validId(tripId)) {
      return Object.freeze({ kind: 'vehicle', citizenId, tripId });
    }
    current = current.parent;
  }
  return null;
}
