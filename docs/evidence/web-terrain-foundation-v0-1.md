# Web Terrain Foundation v0.1 — Acceptance Evidence

## Decision

- **Milestone:** Web Terrain Foundation v0.1
- **Visual gate:** Approved by repository owner
- **Approval date:** 2026-07-27
- **Merge status:** Not performed
- **Implementation PR:** #2

## Verified implementation head

- **Base SHA:** `42520fa277c609f13a36801d01a89453a2d9a0d1`
- **Verified head SHA:** `c5187c4046bc9bea9219bc68cd3d8de251088c67`
- **GitHub Actions run:** `30268961206` — CI run #84
- **Run conclusion:** `success`
- **Runner:** Ubuntu 24.04
- **Node.js policy:** Node.js 22+
- **Package manager:** pnpm 10.13.1
- **Install mode:** `pnpm install --frozen-lockfile`

This evidence record is a documentation-only descendant of the verified implementation head. Production source, package versions, lockfile contents, generator output, and browser fixtures were not changed by this record.

## CI gates

All final-head jobs completed successfully:

| Job | Verified commands |
|---|---|
| Quality and provenance | Prettier check, ESLint, strict TypeScript, production-source provenance scan |
| Unit, geometry, and golden tests | Workspace coverage run including topology, generator, meshing, seam-normal, skirt, presentation, input, and Coastal golden-hash tests |
| Build all packages and applications | Full monorepo build, Terrain Lab build, game-shell build |
| Chromium smoke, interaction, and visual evidence | Playwright browser suite, interactions, save/load, quality policy, context recovery, fixture screenshots |

Browser suite result: **5/5 scenarios passed**.

## Locked Coastal generator evidence

- **Generator version:** `coastal-v1`
- **Curated seed:** `1464156977`
- **Generation attempt:** `0`
- **Height lattice:** `129 × 129`
- **Raw lattice bytes:** `16,641`
- **Height-lattice SHA-256:** `cf04c9c74a8d3520195c8a5b5324f09aeb1a50bda9902e39faa8b24b6f4f492e`

The golden hash is asserted by the repository test suite. A change requires an explicit generator-version or specification decision.

## Geometry evidence

- **Map:** `128 × 128` cells
- **Chunk layout:** `8 × 8`
- **Chunk count:** `64`
- **Chunk size:** `16 × 16` cells
- **Top-surface triangles:** `32,768`
- **Interior vertical faces:** prohibited by architecture and mesher tests
- **Outer skirt:** world perimeter only
- **Normals:** canonical lattice normals copied into chunk-edge duplicates
- **Diagonal fallback:** equal-delta tie resolves to `SW-NE`; checkerboard/parity fallback is absent

## Browser performance observation

Captured from the final-head Chromium evidence artifact:

| Metric | Observed value |
|---|---:|
| Coastal generation | 42.9 ms |
| Terrain presentation | 62.2 ms |
| Chunk count | 64 |
| Surface triangles | 32,768 |
| Renderer | WebGL2 / Three.js |

These are baseline observations, not hard performance budgets for v0.1.

## GitHub Actions artifacts

| Artifact | SHA-256 digest |
|---|---|
| `browser-evidence` | `2478289c03f10bf1465916f2cf88b262b753d21abb33f9c29d709a82ba117852` |
| `coverage` | `018a256e79abfabf692fe96b580998113fcc515b9b063a381ab641f5ea3d246b` |
| `web-app-builds` | `c5410db4b8fbcb67eaaa668a08e8a49e0c52bb62011dc85ef6fadbcb90218b25` |

## Visual evidence hashes

| Screenshot | SHA-256 |
|---|---|
| `coastal-overview.png` | `6486e1431ac7eb70a19435a36f67d2c5d609db2dd9d77525753a2a0b10daa82e` |
| `shape-atlas-overview.png` | `c35ffba6ebe35314685bb4aa218076d4994509ad8275e5ae8f4a233702d725fd` |
| `ramp-north.png` | `e6fbddc09a251237443104aade1186b429f569ee7979763ef40000e6460ba48c` |
| `ramp-south.png` | `95a6802626dc5be706f1697064255530a4f20fdfbad80c2cfc3ee0519cacc7b7` |
| `ramp-east.png` | `ac19413639997f51467987bcd2513c2ac59bfd7d7af250769511663081c14dcc` |
| `ramp-west.png` | `b479b419c644072141c7c5d19de03f3d2421d640c2545d4cb1c2a6a92d1eeb21` |
| `single-corner-high.png` | `49d6182287484d9f42868b3b7c9654b22f4e32face397f2a894686bf121b5d5a` |
| `single-corner-low.png` | `01653c659f9413fac6169c9bd65592e805240c041ff66d41b1a01172596cb9dd` |
| `raised-plateau.png` | `a57c532a1a8c591c15497d3148717e4235023dce4598c916601971297fa5f772` |
| `basin.png` | `4bd5775d3e3038cda87cdc1955201b55495116214c33854ac1d176f7bd48a196` |
| `staircase.png` | `9f4b96fd9a373ca5bbe6403f4062cb1f29022547f09092129b3b7c4c58252f36` |
| `diagonal-ridge.png` | `3b46c0c158172658b3e98c8f59fe38df0f44f95297ddced5ad72b700575b7951` |
| `diagonal-valley.png` | `e4e7e588ce86af763909259d5d0b997af3096b179df5af8e4474fc2a7d756434` |
| `saddle-twist.png` | `dbd8ac5c944bdf450f48ae1a868c95a340f5e8570d2c1cd2c09663b06f2fbd42` |
| `chunk-seam-closeup.png` | `9f6a50ac1a11ad735a0c01988af4d2f1cfa1c5e30d71258b99811ecaed210c19` |
| `outer-boundary-skirt.png` | `67adba1d09a1e17a0083a8e292518bc955ccf50db12b86dde587a8499be0d635` |
| `picking-four-rotations.png` | `af8b631e3d2dc1b615ae4616a7c39539cf7428486959801e614638aa223fc54c` |
| `picking-rotation-0.png` | `a94616feed6b241645ba3280278c6fde0f5ac1182b428efdd5c8b1e6d2f64be7` |
| `picking-rotation-90.png` | `942144a54dea2b66abf20b3c6e54a87f947f873c3a8b24b660bd5c675cf0039b` |
| `picking-rotation-180.png` | `40020c554d3586551c58088effd045fc24622b05fc45e5c848c729d28f08856c` |
| `picking-rotation-270.png` | `af8b631e3d2dc1b615ae4616a7c39539cf7428486959801e614638aa223fc54c` |

## Provenance and clean-room boundary

- Unity terrain behavior was transcribed from the approved architecture document at `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`.
- No Unity production source, generated assets, scene files, or implementation structure was copied.
- No production source, assets, or Micropolis-derived code from `lo-th/3d.city` was copied.
- CI includes a production-source provenance scan.

## Human review

The repository owner approved the visual evidence on 2026-07-27. The approval covers Coastal terrain, Shape Atlas forms, ramps, ridge/valley, basin, staircase, chunk seams, outer skirt, picking rotations, and the minimal game shell.

## Deferred scope

The following remain outside this milestone:

- Water and shoreline rendering
- Hydrology
- Raise, Lower, Flatten, preview, and Undo
- Roads, zones, buildings, utilities, economy, and simulation
- WebGPU renderer
- Physical-device mobile performance certification

Physical-device mobile evidence: **NOT RUN — device unavailable in automated CI**.
