import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { trafficInspectTargetFromObject } from './traffic-inspect-target.js';

describe('trafficInspectTargetFromObject', () => {
  it('resolves child mesh hit to a real pedestrian Citizen target', () => {
    const root = new Group();
    root.userData.trafficAgentKind = 'citizen';
    root.userData.citizenId = 'citizen-1';
    root.userData.tripId = 'trip-1';
    const child = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    root.add(child);
    expect(trafficInspectTargetFromObject(child)).toEqual({
      kind: 'citizen',
      citizenId: 'citizen-1',
      tripId: 'trip-1',
    });
  });

  it('resolves a real vehicle target and rejects anonymous decorative metadata', () => {
    const vehicle = new Group();
    vehicle.userData.trafficAgentKind = 'vehicle';
    vehicle.userData.citizenId = 'citizen-2';
    vehicle.userData.tripId = 'trip-2';
    expect(trafficInspectTargetFromObject(vehicle)).toEqual({
      kind: 'vehicle',
      citizenId: 'citizen-2',
      tripId: 'trip-2',
    });

    const anonymous = new Group();
    anonymous.userData.trafficAgentKind = 'vehicle';
    expect(trafficInspectTargetFromObject(anonymous)).toBeNull();
  });
});
