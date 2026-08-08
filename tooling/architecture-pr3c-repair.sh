#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path
p = Path('tooling/architecture-pr3c-author.sh')
text = p.read_text()
text = text.replace(
    "import { readFileSync } from 'node:fs';\nimport { describe, expect, it } from 'vitest';\n\nconst source = readFileSync(new URL('./game-bootstrap.ts', import.meta.url), 'utf8');",
    "import { readFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\nimport { describe, expect, it } from 'vitest';\n\nconst source = readFileSync(resolve(process.cwd(), 'src/game-bootstrap.ts'), 'utf8');",
    1,
)
text = text.replace(
    "  const housing = synchronizeDwellingInventory(input).proposedSnapshot;\n  return synchronizeWorkplaceInventory({ ...input, snapshot: housing }).proposedSnapshot;",
    "  const housing = synchronizeDwellingInventory({ ...input, snapshot: input.rci }).proposedSnapshot;\n  return synchronizeWorkplaceInventory({ ...input, snapshot: housing }).proposedSnapshot;",
    1,
)
text = text.replace(
    "if ! printf '%s\\n' \"$RED_OUTPUT\" | grep -Eq 'rci-building-reconciliation|SaveCoordinator|publishCommittedDomain|Failed to resolve import|Cannot find module'; then",
    "if ! grep -Eq 'rci-building-reconciliation|SaveCoordinator|publishCommittedDomain|Failed to resolve import|Cannot find module' <<< \"$RED_OUTPUT\"; then",
    1,
)
text = text.replace(
    "# Runtime composition migration.\np = Path('apps/game/src/game-bootstrap.ts')\ntext = p.read_text()\n",
    "# Runtime composition migration.\np = Path('apps/game/src/game-bootstrap.ts')\ntext = p.read_text()\n# The committed-world seam supersedes the legacy RuntimeWorldState staging helper.\nruntime_state_start = text.find(\"interface RuntimeWorldState {\\n\")\nruntime_state_end = text.find(\"\\n}\\n\\nfunction toRenderViewport\", runtime_state_start)\nif runtime_state_start >= 0 and runtime_state_end >= 0:\n    text = text[:runtime_state_start] + text[runtime_state_end + 3:]\nstage_start = text.find(\"function stageTerrainWorld(\\n\")\nstage_end = text.find(\"\\n}\\n\\nfunction frozenDirtyChunks\", stage_start)\nif stage_start >= 0 and stage_end >= 0:\n    text = text[:stage_start] + text[stage_end + 3:]\n# Remove type-only imports whose only consumer was the superseded staging helper.\ntext = text.replace(\"  type BuildingDevelopmentEnvironment,\\n\", \"\", 1)\ntext = text.replace(\"  type BuildingSnapshot,\\n\", \"\", 1)\ntext = text.replace(\"  type RoadPlacementEnvironment,\\n\", \"\", 1)\ntext = text.replace(\"  type ZonePlacementEnvironment,\\n\", \"\", 1)\n",
    1,
)
text = text.replace(
    "git rm .github/workflows/architecture-pr3c-author.yml tooling/architecture-pr3c-author.sh",
    "git rm -f .github/workflows/architecture-pr3c-author.yml tooling/architecture-pr3c-author.sh tooling/architecture-pr3c-repair.sh",
    1,
)
p.write_text(text)
PY

bash tooling/architecture-pr3c-author.sh
