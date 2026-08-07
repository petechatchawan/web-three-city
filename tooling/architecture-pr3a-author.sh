#!/usr/bin/env bash
set -euo pipefail

git config user.name 'architecture-impl-agent'
git config user.email 'architecture-impl-agent@users.noreply.github.com'
pnpm install --frozen-lockfile

cat > packages/building-core/test/building-snapshot-fingerprint.test.ts <<'EOF'
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  createBuildingSnapshot,
  fingerprintBuildingSnapshot,
  type ActiveBuildingInstance,
} from '../src/index.js';

function active(instanceId: string, x: number, z: number): ActiveBuildingInstance {
  return Object.freeze({
    instanceId,
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x, z }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtTick: 24,
  });
}

describe('fingerprintBuildingSnapshot', () => {
  it('canonicalizes revision and every authoritative instance field in stable id order', () => {
    const first = createBuildingSnapshot(
      { revision: 7, instances: [active('building:2', 4, 4), active('building:1', 2, 2)] },
      WORLD_CONFIG,
    );
    const same = createBuildingSnapshot(
      { revision: 7, instances: [active('building:1', 2, 2), active('building:2', 4, 4)] },
      WORLD_CONFIG,
    );
    const moved = createBuildingSnapshot(
      { revision: 7, instances: [active('building:1', 3, 2), active('building:2', 4, 4)] },
      WORLD_CONFIG,
    );

    expect(fingerprintBuildingSnapshot(first)).toBe(fingerprintBuildingSnapshot(same));
    expect(fingerprintBuildingSnapshot(moved)).not.toBe(fingerprintBuildingSnapshot(first));
    expect(
      fingerprintBuildingSnapshot(
        createBuildingSnapshot({ revision: 8, instances: first.instances }, WORLD_CONFIG),
      ),
    ).not.toBe(fingerprintBuildingSnapshot(first));
  });
});
EOF

cat > packages/rci-core/test/rci-tick-consistency.test.ts <<'EOF'
import { createBuildingSnapshot, type ActiveBuildingInstance } from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_CONFIGURATION,
  RciContractError,
  commitRciTick,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  planRciTick,
} from '../src/index.js';

const before: SimulationSnapshot = Object.freeze({ revision: 0, absoluteTick: 32, growthSequence: 0 });
const after: SimulationSnapshot = Object.freeze({ revision: 1, absoluteTick: 33, growthSequence: 0 });

function active(x: number): ActiveBuildingInstance {
  return Object.freeze({
    instanceId: 'building:1',
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x, z: 2 }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtTick: 0,
  });
}

describe('RCI exact Building after-state fence', () => {
  it('rejects same-revision Building content changed after planning', () => {
    const buildingsBefore = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    const buildingsAfter = createBuildingSnapshot({ revision: 1, instances: [active(2)] }, WORLD_CONFIG);
    const changedAfter = createBuildingSnapshot({ revision: 1, instances: [active(3)] }, WORLD_CONFIG);
    const rci = createInitialRciSnapshot({ absoluteTick: before.absoluteTick });
    const registries = createFoundationRciRegistries();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore,
      buildingsAfter,
      registries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(plan.valid).toBe(true);
    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore,
        buildingsAfter: changedAfter,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-building-plan'));
  });

  it('rejects an after Building revision changed after planning', () => {
    const buildingsBefore = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    const buildingsAfter = createBuildingSnapshot({ revision: 1, instances: [active(2)] }, WORLD_CONFIG);
    const changedAfter = createBuildingSnapshot({ revision: 2, instances: [active(2)] }, WORLD_CONFIG);
    const rci = createInitialRciSnapshot({ absoluteTick: before.absoluteTick });
    const registries = createFoundationRciRegistries();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore,
      buildingsAfter,
      registries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore,
        buildingsAfter: changedAfter,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-building-plan'));
  });
});
EOF

set +e
RED_OUTPUT=$(pnpm --filter @web-three-city/building-core test -- test/building-snapshot-fingerprint.test.ts 2>&1)
RED_STATUS=$?
set -e
if [ "$RED_STATUS" -eq 0 ]; then echo 'Expected Building fingerprint RED failure.' >&2; exit 1; fi
printf '%s\n' "$RED_OUTPUT"
if ! printf '%s\n' "$RED_OUTPUT" | grep -Eq 'fingerprintBuildingSnapshot|is not a function|export'; then
  echo 'Building fingerprint RED failed for an unexpected reason.' >&2
  exit 1
fi

cat > packages/building-core/src/building-snapshot-fingerprint.ts <<'EOF'
import { buildingInstances } from './building-snapshot.js';
import type { BuildingSnapshot } from './contracts.js';

export function fingerprintBuildingSnapshot(snapshot: BuildingSnapshot): string {
  const instances = buildingInstances(snapshot)
    .map((instance) => ({
      instanceId: instance.instanceId,
      buildingDefinitionId: instance.buildingDefinitionId,
      buildingDefinitionVersion: instance.buildingDefinitionVersion,
      originCell: { x: instance.originCell.x, z: instance.originCell.z },
      rotationQuarterTurns: instance.rotationQuarterTurns,
      lifecycle: instance.lifecycle,
      ...(instance.lifecycle === 'construction'
        ? {
            constructionStartedAtTick: instance.constructionStartedAtTick,
            constructionCompletesAtTick: instance.constructionCompletesAtTick,
          }
        : { activatedAtTick: instance.activatedAtTick }),
    }))
    .sort((first, second) => first.instanceId.localeCompare(second.instanceId));
  return `building-snapshot-v1:${JSON.stringify({ revision: snapshot.revision, instances })}`;
}
EOF

python <<'PY'
from pathlib import Path
p = Path('packages/building-core/src/index.ts')
text = p.read_text()
line = "export * from './building-snapshot-fingerprint.js';\n"
if line not in text:
    text = text.replace("export * from './building-snapshot.js';\n", "export * from './building-snapshot.js';\n" + line)
p.write_text(text)

p = Path('packages/rci-core/src/rci-tick.ts')
text = p.read_text()
text = text.replace(
    "import type { BuildingSnapshot } from '@web-three-city/building-core';",
    "import { fingerprintBuildingSnapshot, type BuildingSnapshot } from '@web-three-city/building-core';",
)
text = text.replace(
    "  readonly baseBuildingRevision: number;\n  readonly beforeAbsoluteTick: number;",
    "  readonly baseBuildingRevision: number;\n  readonly afterBuildingRevision: number;\n  readonly afterBuildingFingerprint: string;\n  readonly beforeAbsoluteTick: number;",
)
text = text.replace(
    "    baseBuildingRevision: input.buildingsBefore.revision,\n    beforeAbsoluteTick:",
    "    baseBuildingRevision: input.buildingsBefore.revision,\n    afterBuildingRevision: input.buildingsAfter.revision,\n    afterBuildingFingerprint: fingerprintBuildingSnapshot(input.buildingsAfter),\n    beforeAbsoluteTick:",
)
# The valid return has the same base fields, but only replace if after fields are still absent near final return.
needle = "    baseBuildingRevision: input.buildingsBefore.revision,\n    beforeAbsoluteTick: input.simulationBefore.absoluteTick,\n    afterAbsoluteTick: input.simulationAfter.absoluteTick,\n    proposedSnapshot: snapshot,"
replacement = "    baseBuildingRevision: input.buildingsBefore.revision,\n    afterBuildingRevision: input.buildingsAfter.revision,\n    afterBuildingFingerprint: fingerprintBuildingSnapshot(input.buildingsAfter),\n    beforeAbsoluteTick: input.simulationBefore.absoluteTick,\n    afterAbsoluteTick: input.simulationAfter.absoluteTick,\n    proposedSnapshot: snapshot,"
text = text.replace(needle, replacement)
text = text.replace(
    "  if (input.buildingsBefore.revision !== plan.baseBuildingRevision) {\n    throw new RciContractError('rci:stale-building-plan');\n  }",
    "  if (\n    input.buildingsBefore.revision !== plan.baseBuildingRevision ||\n    input.buildingsAfter.revision !== plan.afterBuildingRevision ||\n    fingerprintBuildingSnapshot(input.buildingsAfter) !== plan.afterBuildingFingerprint\n  ) {\n    throw new RciContractError('rci:stale-building-plan');\n  }",
)
p.write_text(text)

p = Path('packages/rci-core/src/persistence/migration-inventory.ts')
text = p.read_text()
if "synchronizeWorkplaceInventory" not in text:
    text = text.replace(
        "import type { RciDefinitionRegistries } from '../definitions/contracts.js';\n",
        "import type { RciDefinitionRegistries } from '../definitions/contracts.js';\nimport { synchronizeWorkplaceInventory } from '../employment/workplace-inventory.js';\n",
    )
old = """  return synchronizeDwellingInventory({
    snapshot: initial,
    buildingsBefore: Object.freeze({ revision: 0, instances: Object.freeze([]) }),
    buildingsAfter: input.buildings,
    registries: input.registries,
    evaluationTick: input.absoluteTick,
  }).proposedSnapshot;
"""
new = """  const emptyBuildings = Object.freeze({ revision: 0, instances: Object.freeze([]) });
  const withDwellings = synchronizeDwellingInventory({
    snapshot: initial,
    buildingsBefore: emptyBuildings,
    buildingsAfter: input.buildings,
    registries: input.registries,
    evaluationTick: input.absoluteTick,
  }).proposedSnapshot;
  return synchronizeWorkplaceInventory({
    snapshot: withDwellings,
    buildingsBefore: emptyBuildings,
    buildingsAfter: input.buildings,
    registries: input.registries,
    evaluationTick: input.absoluteTick,
  }).proposedSnapshot;
"""
if old not in text:
    raise SystemExit('migration inventory shape changed unexpectedly')
p.write_text(text.replace(old, new))
PY

pnpm format
pnpm --filter @web-three-city/building-core test -- test/building-snapshot-fingerprint.test.ts
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/rci-core test -- test/rci-tick-consistency.test.ts test/rci-tick-foundation.test.ts
pnpm --filter @web-three-city/rci-core typecheck

git rm .github/workflows/architecture-pr3a-author.yml tooling/architecture-pr3a-author.sh
git add packages/building-core/src/building-snapshot-fingerprint.ts packages/building-core/src/index.ts packages/building-core/test/building-snapshot-fingerprint.test.ts packages/rci-core/src/rci-tick.ts packages/rci-core/src/persistence/migration-inventory.ts packages/rci-core/test/rci-tick-consistency.test.ts
git commit -m 'fix(rci): fence exact Building after-state'
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git push origin HEAD:refactor/dependent-world-consistency-v0-1
