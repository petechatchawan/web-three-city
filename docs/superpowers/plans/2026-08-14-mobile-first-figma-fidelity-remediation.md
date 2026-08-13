# Mobile-First Figma Fidelity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate PR #59 so the `.city-ui` shell matches the approved mobile-first City UI Foundation direction, using 390×844 as the primary visual acceptance viewport while preserving all M1–M5 runtime behavior.

**Architecture:** Keep `.city-ui` as the single UI authority and change presentation only. Replace generic global button presentation with explicit game-UI variants, introduce local inline SVG icon markup, recompose HUD/nav/tray/context/simulation surfaces for mobile, and make shared management sheets use dense section/card layouts without changing callback or domain authority.

**Tech Stack:** TypeScript, DOM APIs, CSS, Vitest, Playwright, Three.js/Vite workspace.

## Global Constraints

- Primary acceptance viewport: 390×844.
- Secondary acceptance viewports: 844×390 and 1440×900.
- Preserve existing `data-testid`, `data-tool-mode`, `data-brush-size`, and `data-nav-category` contracts.
- Preserve minimum touch target size of 44×44 CSS px.
- Preserve light-only theme, Outfit + DM Mono, safe-area, focus-visible, and reduced-motion contracts.
- No domain/save/simulation/tool-authority redesign.
- No new UI framework or runtime icon dependency.
- No reintroduction of legacy game UI mounts or mirror state.

---

### Task 1: Lock presentation contracts in tests

**Files:** shell unit tests + responsive Playwright spec.

- [ ] Add assertions for icon+label nav, semantic HUD groups, explicit tool/simulation variants, compact context, sticky sheet chrome, and mobile viewport containment.
- [ ] Run focused tests and confirm the new assertions fail before implementation.

### Task 2: Add local icons and explicit visual tokens

**Files:** `ui/components/icon.ts`, icon tests, `ui/foundation/tokens.css`, token tests.

- [ ] Implement dependency-free inline SVG icons with stable `data-city-icon` names.
- [ ] Add spacing/radius/type/icon/elevation/surface tokens.
- [ ] Remove presentation authority from the generic button rule.

### Task 3: Rebuild mobile shell composition

**Files:** HUD, bottom nav, subtool tray, brush selector, simulation controls, tool context, player shell, `city-ui.css`.

- [ ] Recompose HUD into primary and secondary semantic groups.
- [ ] Use five icon+label nav items only in the bottom bar.
- [ ] Put simulation controls in a separate segmented capsule.
- [ ] Use white tray + dark tool pills and segmented brush sizes.
- [ ] Make tool context compact with icon-based Undo and clear collapse affordance.

### Task 4: Recompose top actions and management sheets

**Files:** top actions, dialog host, city system dialogs, city runtime, CSS.

- [ ] Convert Information Views / City / Game Menu to icon buttons with accessible labels.
- [ ] Use sticky mobile sheet chrome.
- [ ] Recompose City Overview into KPI cards + secondary details + system shortcuts.
- [ ] Recompose Game Menu into World / Camera / Presentation sections with action tiles.

### Task 5: Responsive acceptance hardening

- [ ] 390×844: no horizontal overflow; five nav tabs visible; simulation separate; tray/context/top actions in viewport.
- [ ] 844×390: compact stacking; required controls reachable; sheet scrollable.
- [ ] 1440×900: same mobile-first visual language with capped widths.

### Task 6: Verification and closure

- [ ] Run `pnpm verify`.
- [ ] Run full browser suite.
- [ ] Run `pnpm verify:full` on exact head.
- [ ] Update closure evidence and keep owner Manual Acceptance as final merge gate.
