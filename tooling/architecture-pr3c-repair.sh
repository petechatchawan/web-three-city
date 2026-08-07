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
    "git rm .github/workflows/architecture-pr3c-author.yml tooling/architecture-pr3c-author.sh",
    "git rm -f .github/workflows/architecture-pr3c-author.yml tooling/architecture-pr3c-author.sh tooling/architecture-pr3c-repair.sh",
    1,
)
p.write_text(text)
PY

bash tooling/architecture-pr3c-author.sh
