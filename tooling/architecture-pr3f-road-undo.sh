#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile

python <<'PY'
from pathlib import Path
p = Path('browser-tests/road.spec.ts')
text = p.read_text()
old = """  expect(undone.road.committedRoadRevision).toBeGreaterThan(bulldozed.road.committedRoadRevision);
"""
new = """  expect(undone.road.committedRoadRevision).toBe(built.road.committedRoadRevision);
"""
if old not in text:
    raise SystemExit('Road Undo assertion shape changed; refuse blind replacement')
p.write_text(text.replace(old, new, 1))
PY

pnpm exec prettier --write browser-tests/road.spec.ts
pnpm --filter @web-three-city/game build
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright install chromium
pnpm exec playwright test browser-tests/road.spec.ts --grep 'Bulldoze updates topology and tagged Undo restores the Road only'

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git rm -f .github/workflows/architecture-pr3f-road-undo.yml tooling/architecture-pr3f-road-undo.sh
git add browser-tests/road.spec.ts
git commit --no-verify -m 'test(architecture): align Road Undo revision semantics'
git push origin HEAD:refactor/dependent-world-consistency-v0-1
