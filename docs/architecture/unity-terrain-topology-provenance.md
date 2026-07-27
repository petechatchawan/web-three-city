# Unity Terrain Topology Provenance

## Normative source

- Repository: `petechatchawan/cityBuilder`
- Commit: `19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`
- Document: `docs/terrain/terrain-architecture-lab-implementation-packet-v0.1.md`
- Corner order: `[NW, NE, SW, SE]`
- Pair A: `SW-NE`
- Pair B: `NW-SE`

## Accepted selector

1. When exactly one opposite-corner pair has equal endpoint levels, select that pair.
2. When both pairs are equal or neither pair is equal, compare absolute endpoint deltas.
3. Select the pair with the smaller absolute endpoint delta.
4. When the deltas tie, select `SW-NE`.
5. Checkerboard or coordinate-parity selection is superseded and forbidden.

## Transcription boundary

This web implementation manually transcribes the accepted decision rules and authored fixture values. It does not copy Unity production source, generated assets, scene files, class structure, or implementation-specific code. The web implementation remains an original TypeScript implementation.
