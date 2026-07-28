# Prototype Interaction Completion v0.1 — Acceptance Evidence

## Decision

- **Milestone:** Prototype Interaction Completion v0.1
- **Automated acceptance:** Passed
- **Automated evidence date:** 2026-07-28
- **Owner physical-feel gate:** Pending
- **Merge status:** Not performed
- **Implementation PR:** #4

This record closes the automated implementation and evidence tasks. It does not claim physical-device touch approval and does not authorize merge.

## Verified implementation head

- **Base SHA:** `fdf970e39c65c354ae20c42b2c6db20f84873223`
- **Verified source head SHA:** `50010a25ed5926ab0a01c3c6d5245a67a18fed56`
- **GitHub pull-request merge ref tested by CI:** `1df980f1807542f45fce64563d5d6187c579f097`
- **GitHub Actions run:** `30299149192` — CI run #160
- **Run conclusion:** `success`
- **Runner:** Ubuntu 24.04
- **Node.js policy:** Node.js 22
- **Package manager:** pnpm 10.13.1
- **Install mode:** `pnpm install --frozen-lockfile`
- **Three.js:** 0.185.1
- **Playwright:** 1.61.1
- **Chromium:** 149.0.7827.55

The pull-request merge ref is GitHub's synthetic merge of the verified source head into the listed base. This evidence document is a documentation-only descendant of the verified implementation head.

## CI gates

All jobs completed successfully on the exact verified source head:

| Job | Verified scope |
|---|---|
| Quality and provenance | Prettier, ESLint, strict TypeScript, clean-room provenance scan |
| Unit, geometry, and golden tests | Camera state/framing, anchoring, gesture arbitration, DOM binding, overlay geometry, presentation lifecycle, existing terrain/generator regression suites |
| Build all packages and applications | Full workspace build, Terrain Lab build, Game build |
| Chromium smoke, interaction, and visual evidence | Desktop/mobile framing, pan, wheel zoom, pinch, continuous yaw, pitch, cancellation, third-contact suppression, UI ownership, reset, selection, grid, save/load, resize, context recovery, screenshots, traces, and performance observation |

Browser suite result: **18/18 tests passed**.

| Browser file | Result |
|---|---:|
| `game.spec.ts` | 5/5 |
| `interaction.spec.ts` | 9/9 |
| `terrain-lab.spec.ts` | 2/2 |
| `visual-evidence.spec.ts` | 2/2 |

## Delivered interaction contract

- Primary-pointer or one-finger drag pans camera-relative to the current yaw.
- Tap/click below the movement slop selects one authoritative Terrain cell.
- Mouse wheel and two-finger pinch perform Terrain-anchored orthographic zoom.
- Two-finger twist changes yaw continuously; Rotate buttons and Q/E remain exact 90-degree operations.
- Parallel two-finger vertical movement changes pitch within the locked design and hard safety ranges.
- The first two accepted contacts own a gesture; a third contact suppresses output until all contacts release.
- Pointer cancellation, lost capture, blur, context loss, and disposal clear active gesture state.
- UI-origin pointer sessions never become world input.
- Home and Reset Camera restore the canonical fitted view.
- Desktop and mobile portrait framing use the usable viewport after UI insets.
- Selected-cell and terrain-conforming grid presentations are separate from authoritative Terrain geometry.
- Grid visibility toggles without rebuilding grid geometry.
- Context restoration preserves Terrain, grid, and selection with exactly one presentation root each.

## Canonical camera policy

| Parameter | Locked value |
|---|---:|
| Default yaw | 45 degrees |
| Default pitch | 50 degrees |
| Design pitch range | 35–65 degrees |
| Hard pitch range | 20–80 degrees |
| Fitted-view margin | 8% of usable viewport |
| Button/keyboard rotation | 90 degrees per operation |

## Interaction performance observation

Captured inside Chromium by synchronously timing 30 processed two-pointer frames:

| Metric | Observed value |
|---|---:|
| Processed pointer frames | 30 |
| Median pointer-frame processing | 0 ms |
| p95 pointer-frame processing | 0.1000000000349246 ms |
| Selection rebuilds in evidence sequence | 1 |
| Grid rebuilds after initial load | 0 |

The median is quantized to zero by the browser timer resolution; it does not mean processing has no cost. The v0.1 observation target of less than 1 ms median on the CI desktop was met. These values are observations, not hard cross-device budgets.

## GitHub Actions artifacts

| Artifact | SHA-256 digest |
|---|---|
| `browser-evidence` | `fa629e51fa4f7863dde3f691b5a5ebea460b1001806d7edca33c5bcf186b0bd2` |
| `coverage` | `df5df4e764faaa0694c0d1fabb28d126cba6111cebb72243a97f0b72034ea00c` |
| `web-app-builds` | `ca05d8ee0b715af5a2d1876b66d36af07e7951a8af378f536cf05d0ecfb54faf` |

## Interaction screenshot hashes

| Screenshot | SHA-256 |
|---|---|
| `interaction-desktop-initial-fit.png` | `880411541829ee590ccd2c651dd14aa8cff7b9ed91d28cd62647cc1cab76afad` |
| `interaction-mobile-portrait-initial-fit.png` | `4606eb648e1dbd5d0f41c1fbabcf6b62366acfbbb73425d30529a6e069fa8f97` |
| `interaction-grid-on.png` | `56bd9319f4215c518162d2ddecb3e2d6f456d4eae52af2f4dfcab74fe6a1b775` |
| `interaction-selected-cell.png` | `4d221db52aa9afdd14472406af2f97625812f0324c5aab63970dc20cf88cb4fe` |
| `interaction-pan-result.png` | `cbda4a839dbfe2d7c5e9571c3d74112a59165eedc5ed84b4c6b530c9ecb1841a` |
| `interaction-zoom-in.png` | `4ece974f4d395c899b1aabe8208bed342434d161311539c3db4847afc4bf611b` |
| `interaction-yaw-continuous.png` | `f4f372ae7cc5ac0659858910991af5499bec45fa1df8b725a766c7b0a5109ab9` |
| `interaction-pitch-top-down.png` | `efa69849300764b576ee89f3e6d1f5894fa22a1c39c71fbe9062d49c18ede9a2` |
| `interaction-pitch-horizon.png` | `e452295f53ac0339a360b689251246e9dd905118c1228e1b8928609e18bba215` |
| `interaction-reset.png` | `5071a21a4b9e00c1fa4265deb5b75c0a3b149ffe21c00e08f0f2f8201fe482d2` |

## Performance and trace hashes

| Evidence file | SHA-256 |
|---|---|
| `interaction-performance-evidence.json` | `56f57400c1903246cbfa8967d8ff1e658563d75e0dcb7ef2b2ae0a6722078e6e` |
| Interaction visual sequence `trace.zip` | `54f237016534b5a3553a0b08a9708000b5aa138db06b4ca5d50781e94373023c` |
| Terrain visual sequence `trace.zip` | `98ffd7ad67b3edb41597f9eb1785cd830996943e8fa1a634c42acfb31ac36936` |

## Visual self-review

The final artifacts show:

- The full Terrain fits inside the usable desktop viewport instead of overflowing behind the control panel.
- Mobile portrait mode moves the playable viewport below the compact control panel and keeps the full Terrain visible.
- Grid lines follow the Terrain surface.
- Selected-cell presentation remains aligned to the Terrain surface.
- Pan, zoom, continuous yaw, top-down pitch, horizon pitch, and reset produce distinct captured states.
- Context/lifecycle tests confirm exactly one Terrain root, one grid root, and one selection root after restoration.

Automated screenshots cannot establish touch comfort, gesture sensitivity preference, palm rejection quality, or physical-device frame pacing.

## Provenance and scope boundary

- The interaction behavior was transcribed from the approved Unity camera interaction specification and plan; Unity production source and assets were not copied.
- No third-party camera-control implementation was imported.
- Water, shoreline, Terraform, Roads, zones, buildings, simulation, inertia, perspective projection, and generic object selection remain outside this milestone.

## Human review

Owner desktop/mobile physical-feel review: **PENDING**.

The owner should verify pan direction, pinch sensitivity, continuous yaw sensitivity, pitch comfort, selection slop, grid readability, and reset framing on the intended browser/device before merge authorization.
