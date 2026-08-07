#!/usr/bin/env bash
set -euo pipefail

python <<'PY'
from pathlib import Path
p = Path('tooling/architecture-pr3b-author.sh')
text = p.read_text()
text = text.replace(
    "    expect(loaded.status).toBe('committed');\n    if (loaded.status === 'committed') {",
    "    if (loaded.status === 'rejected') throw new Error(`load-rejected:${loaded.reason}`);\n    expect(loaded.status).toBe('committed');\n    if (loaded.status === 'committed') {",
    1,
)
text = text.replace(
    "    expect(store.snapshot()).toEqual(initial);",
    "    expect(fingerprintCommittedWorld(store.snapshot())).toBe(\n      fingerprintCommittedWorld(initial),\n    );",
    1,
)
text = text.replace(
    "git rm .github/workflows/architecture-pr3b-author.yml tooling/architecture-pr3b-author.sh",
    "git rm .github/workflows/architecture-pr3b-author.yml tooling/architecture-pr3b-author.sh tooling/architecture-pr3b-repair.sh",
    1,
)
p.write_text(text)
PY

bash tooling/architecture-pr3b-author.sh
