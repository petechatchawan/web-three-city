# MIT License Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `web-three-city` under the standard MIT License with explicit repository metadata and README attribution.

**Architecture:** Licensing is declared once at the repository root. The canonical grant lives in `LICENSE`; `package.json` exposes the SPDX identifier and `README.md` links readers to the canonical text without introducing additional restrictions.

**Tech Stack:** Markdown, JSON, Node.js 22+, pnpm 10.13.1

## Global Constraints

- Copyright holder: `Pete Chatchawan`.
- Copyright year: `2026`.
- Use the standard MIT License text with no custom additional terms.
- Do not add trademark, game-name, logo, branding, publicity, noncommercial, or copyleft restrictions.
- Third-party dependencies and assets remain governed by their own licenses.
- Do not change runtime source code or behavior.

---

### Task 1: Adopt the MIT License

**Files:**
- Create: `LICENSE`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: MIT license text identified by SPDX as `MIT`.
- Produces: repository-level `LICENSE`, root package metadata `license: "MIT"`, and README license disclosure.

- [ ] **Step 1: Add the canonical license text**

Create `LICENSE` with the standard MIT License text and this holder line:

```text
Copyright (c) 2026 Pete Chatchawan
```

Do not append project-specific restrictions.

- [ ] **Step 2: Declare the SPDX identifier**

Add this root-level property immediately after `"private": true` in `package.json`:

```json
"license": "MIT"
```

- [ ] **Step 3: Document the license**

Append this section to `README.md`:

```markdown
## License

The source code in this repository is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Pete Chatchawan.
```

- [ ] **Step 4: Verify metadata and text**

Run:

```bash
node --input-type=module -e "import { readFileSync } from 'node:fs'; const pkg=JSON.parse(readFileSync('package.json','utf8')); const license=readFileSync('LICENSE','utf8'); const readme=readFileSync('README.md','utf8'); if(pkg.license!=='MIT') throw new Error('package license is not MIT'); if(!license.startsWith('MIT License\n\nCopyright (c) 2026 Pete Chatchawan')) throw new Error('license header mismatch'); if(!license.includes('Permission is hereby granted, free of charge')) throw new Error('MIT grant missing'); if(!license.includes('THE SOFTWARE IS PROVIDED \"AS IS\"')) throw new Error('MIT warranty disclaimer missing'); if(!readme.includes('[MIT License](LICENSE)')) throw new Error('README license link missing'); console.log('MIT license verification passed.');"
pnpm exec prettier --check package.json README.md docs/superpowers/specs/2026-08-03-mit-license-design.md docs/superpowers/plans/2026-08-03-mit-license.md
pnpm verify
```

Expected: all commands exit `0`; metadata verification prints `MIT license verification passed.`

- [ ] **Step 5: Commit**

```bash
git add LICENSE package.json README.md docs/superpowers/plans/2026-08-03-mit-license.md
git commit -m "docs: adopt MIT license"
```
