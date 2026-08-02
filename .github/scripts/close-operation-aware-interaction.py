from __future__ import annotations

import json
import re
from pathlib import Path

SPEC_PATH = Path(
    "docs/superpowers/specs/2026-08-02-operation-aware-road-preview-release-camera-pan-design.md"
)
PLAN_PATH = Path(
    "docs/superpowers/plans/2026-08-02-operation-aware-road-preview-release-camera-pan.md"
)
VERCEL_PATH = Path("vercel.json")

IMPLEMENTATION_SHA = "a6601ca6fc27ef66b62f0d793fb7bc2a4ea39255"
WORKFLOW_RUN_ID = "30741559482"
ARTIFACT_ID = "8831627313"
ARTIFACT_DIGEST = "sha256:e539930b91c16b1855984a0560e2d838bdc9d4bf54747dde38407ff3875f6e0e"

spec = SPEC_PATH.read_text(encoding="utf-8")
spec = spec.replace("**Status:** Approved", "**Status:** Implemented and verified", 1)
closure_heading = "## Closure Evidence"
if closure_heading not in spec:
    spec = spec.rstrip() + f"""

{closure_heading}

- Implementation commit: `master@{IMPLEMENTATION_SHA}`.
- GitHub Actions run: `{WORKFLOW_RUN_ID}` (`implement` job passed).
- Evidence artifact: `{ARTIFACT_ID}` with digest `{ARTIFACT_DIGEST}`.
- TDD RED reproduced all four missing contracts before production changes.
- Focused Vitest: 6 files, 29/29 tests passed.
- Repository verification: formatting, ESLint, TypeScript, provenance, 297 unit tests, deployment tests, and all workspace builds passed through `pnpm check`.
- Focused Chromium acceptance: 2/2 tests passed.
- Full Chromium/WebGL acceptance: 103/103 tests passed, including operation-specific Road Preview, release outside Terrain, rotated camera pan, desktop/mobile evidence, Terraform, Water, save/load, Undo, and context restoration.
- Final implementation tree removed every temporary operation-aware workflow, trigger, and execution script.
- Automated Vercel Git deployments are disabled; releases remain manual-only.
"""
SPEC_PATH.write_text(spec.rstrip() + "\n", encoding="utf-8")

plan = PLAN_PATH.read_text(encoding="utf-8")
plan = re.sub(
    r"\*\*Execution Status:\*\*.*",
    f"**Execution Status:** Complete and verified on `master@{IMPLEMENTATION_SHA}`.",
    plan,
    count=1,
)
plan = re.sub(r"(?m)^- \[ \]", "- [x]", plan)
plan_closure_heading = "## Final Verification Record"
if plan_closure_heading not in plan:
    plan = plan.rstrip() + f"""

---

{plan_closure_heading}

**Verdict:** COMPLETE

- Exact implementation tree: `{IMPLEMENTATION_SHA}`.
- Verification workflow run: `{WORKFLOW_RUN_ID}`.
- Artifact: `{ARTIFACT_ID}` (`{ARTIFACT_DIGEST}`).
- Focused Vitest: 29/29 passed.
- Full repository gate: `pnpm check` passed, including 297 unit tests and all workspace builds.
- Focused Chromium: 2/2 passed.
- Full Chromium/WebGL: 103/103 passed in 14.7 minutes.
- Temporary workflows, triggers, and runner scripts: removed from the final tree.
- Vercel deployment policy: manual-only (`git.deploymentEnabled: false`).
"""
if re.search(r"(?m)^- \[ \]", plan):
    raise SystemExit("unchecked implementation-plan items remain")
PLAN_PATH.write_text(plan.rstrip() + "\n", encoding="utf-8")

vercel = json.loads(VERCEL_PATH.read_text(encoding="utf-8"))
if vercel.get("git", {}).get("deploymentEnabled") is not False:
    raise SystemExit("vercel.json is not manual-only")

print(f"updated {SPEC_PATH}")
print(f"updated {PLAN_PATH}")
print("verified manual-only Vercel configuration")
