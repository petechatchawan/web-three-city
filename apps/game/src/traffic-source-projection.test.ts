import { describe, expect, it } from 'vitest';
import { createApplicationFixture } from '../test/application-fixtures.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjectionFromEnvironment,
} from './traffic-source-projection.js';

describe('Traffic source projection cache', () => {
  it('reuses immutable road and building access projections', () => {
    const world = createApplicationFixture({ withCommercialBuilding: true });

    const roadsFirst = createRoadTrafficSourceProjectionFromEnvironment(
      world.roads,
      world.environments.building,
    );
    const roadsSecond = createRoadTrafficSourceProjectionFromEnvironment(
      world.roads,
      world.environments.building,
    );
    const accessFirst = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );
    const accessSecond = createBuildingTrafficAccessProjection(
      world.buildings,
      world.roads,
      world.environments.building,
    );

    expect(roadsSecond).toBe(roadsFirst);
    expect(accessSecond).toBe(accessFirst);
  });
});
