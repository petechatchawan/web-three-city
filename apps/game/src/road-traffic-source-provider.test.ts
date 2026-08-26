import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { createApplicationFixture } from '../test/application-fixtures.js';
import { createCommittedWorld } from './application/committed-world.js';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createRoadSnapshot } from '@web-three-city/road-core';
import { describe, expect, it, vi } from 'vitest';
import { createRoadTrafficSourceProjectionFromEnvironment } from './traffic-source-projection.js';
import {
  createRoadTrafficSourceProjectionProvider,
  type RoadTrafficSourceProjectionDeriver,
} from './road-traffic-source-provider.js';

describe('Road traffic source projection provider', () => {
  it('reuses one projection across authority and subscriber requests', () => {
    const world = createCommittedWorld(createApplicationFixture());
    const derive = vi.fn<RoadTrafficSourceProjectionDeriver>(
      createRoadTrafficSourceProjectionFromEnvironment,
    );
    const provider = createRoadTrafficSourceProjectionProvider(derive);

    const authorityProjection = provider.get(world.roads, world.environments.building);
    const subscriberProjection = provider.get(world.roads, world.environments.building);

    expect(subscriberProjection).toBe(authorityProjection);
    expect(derive).toHaveBeenCalledTimes(1);
    expect(subscriberProjection.roadRevision).toBe(world.roads.revision);
  });

  it('keeps dynamic traffic changes on the same static projection', () => {
    const world = createCommittedWorld(createApplicationFixture());
    const derive = vi.fn<RoadTrafficSourceProjectionDeriver>(
      createRoadTrafficSourceProjectionFromEnvironment,
    );
    const provider = createRoadTrafficSourceProjectionProvider(derive);

    const first = provider.get(world.roads, world.environments.building);
    const second = provider.get(world.roads, world.environments.building);

    expect(second).toBe(first);
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('invalidates on road identity or building-environment identity changes', () => {
    const world = createCommittedWorld(createApplicationFixture());
    const derive = vi.fn<RoadTrafficSourceProjectionDeriver>(
      createRoadTrafficSourceProjectionFromEnvironment,
    );
    const provider = createRoadTrafficSourceProjectionProvider(derive);
    const first = provider.get(world.roads, world.environments.building);

    const roadCodes = world.roads.definitionCodes;
    roadCodes[0] = 1;
    const changedRoads = createRoadSnapshot(
      {
        width: world.roads.width,
        height: world.roads.height,
        revision: world.roads.revision,
        definitionCodes: roadCodes,
      },
      WORLD_CONFIG,
    );
    const second = provider.get(changedRoads, world.environments.building);
    const changedEnvironment = createBuildingDevelopmentEnvironment(
      world.terrain,
      world.water,
      world.roads,
      world.zones,
      WORLD_CONFIG,
    );
    const third = provider.get(world.roads, changedEnvironment);

    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
    expect(derive).toHaveBeenCalledTimes(3);
  });

  it('does not use numeric revisions as the cache key', () => {
    const world = createCommittedWorld(createApplicationFixture());
    const derive = vi.fn<RoadTrafficSourceProjectionDeriver>(
      createRoadTrafficSourceProjectionFromEnvironment,
    );
    const provider = createRoadTrafficSourceProjectionProvider(derive);
    const first = provider.get(world.roads, world.environments.building);
    const roadCodes = world.roads.definitionCodes;
    roadCodes[0] = 1;
    const sameRevisionDifferentRoads = createRoadSnapshot(
      {
        width: world.roads.width,
        height: world.roads.height,
        revision: world.roads.revision,
        definitionCodes: roadCodes,
      },
      WORLD_CONFIG,
    );

    const second = provider.get(sameRevisionDifferentRoads, world.environments.building);

    expect(second).not.toBe(first);
    expect(second.roadRevision).toBe(first.roadRevision);
    expect(derive).toHaveBeenCalledTimes(2);
  });
});
