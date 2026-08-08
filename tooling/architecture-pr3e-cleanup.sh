#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile
python <<'PY'
from pathlib import Path
p = Path('apps/game/src/game-bootstrap.ts')
text = p.read_text()
text = text.replace("import { deriveWaterSnapshot, type WaterSnapshot } from '@web-three-city/water-core';\n", '', 1)
text = text.replace("import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';\n", '', 1)
text = text.replace("import { createRoadPlacementEnvironment } from './road-placement-environment.js';\n", '', 1)
text = text.replace("import { createZonePlacementEnvironment } from './zone-placement-environment.js';\n", '', 1)
start = text.find('function requireWater(snapshot: TerrainSnapshot): WaterSnapshot {\n')
end = text.find('\n}\n\nfunction frozenDirtyChunks', start)
if start >= 0 and end >= 0:
    text = text[:start] + text[end + 3:]
else:
    raise SystemExit('requireWater shape changed')
text = text.replace(
    'const runBackgroundGrowthTick = (_simulation?: SimulationSnapshot): SimulationSnapshot => {',
    'const runBackgroundGrowthTick = (): SimulationSnapshot => {',
    1,
)
text = text.replace(
    'const runSimulationOnlyTick = (_simulation?: SimulationSnapshot): SimulationSnapshot => {',
    'const runSimulationOnlyTick = (): SimulationSnapshot => {',
    1,
)
text = text.replace(
    "    if (publication.result.status === 'committed') {\n      undoCoordinator.clear();\n      notifyCommittedWorld(publication.result.world, 'reset');\n      return publication.result.world;\n    }",
    "    if (publication.result.status === 'committed') {\n      undoCoordinator.clear();\n      return publication.result.world;\n    }",
    1,
)
p.write_text(text)
PY

pnpm exec prettier --write apps/game/src/game-bootstrap.ts
pnpm lint
pnpm --filter @web-three-city/game test -- src/game-runtime-authority.test.ts src/application/world-transaction-coordinator.test.ts
pnpm --filter @web-three-city/game typecheck

git rm -f .github/workflows/architecture-pr3e-cleanup.yml tooling/architecture-pr3e-cleanup.sh
git add apps/game/src/game-bootstrap.ts
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git commit --no-verify -m 'refactor(game): clean committed runtime migration'
git push origin HEAD:refactor/dependent-world-consistency-v0-1
