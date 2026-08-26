import type { CommittedWorld } from './committed-world.js';

/**
 * Test-time deterministic stepping suppresses intermediate presentation commits.
 * A full static Three.js rebuild is only required when immutable world authority
 * changed; dynamic Simulation/Mobility/Traffic publications do not invalidate it.
 */
export function staticPresentationNeedsRebuild(
  previous: CommittedWorld,
  next: CommittedWorld,
): boolean {
  return (
    previous.terrain !== next.terrain ||
    previous.water !== next.water ||
    previous.roads !== next.roads ||
    previous.zones !== next.zones ||
    previous.buildings !== next.buildings ||
    previous.environments !== next.environments
  );
}
