# Road World-Origin Visibility Fix

## User-observed defect

Road Build completed successfully and enabled Undo, but neither Road Preview nor committed Road geometry was visible in the Game viewport.

## Root cause

Terrain mesh coordinates center the map around the world origin by subtracting half of the map width and height. Road surface geometry and invalid markers previously used raw cell coordinates, displacing Road presentation by 64 world units on both X and Z for the 128 × 128 map.

## TDD evidence

- Road surface RED: center-cell maximum X was `64.86000061035156`, expected at most `1`.
- Invalid-marker RED: center-cell maximum X was `4.840000152587891` in the 8 × 8 test map, expected at most `1`.
- Production correction applies the same centered coordinate frame used by Terrain.
- Unit tests cover committed/valid Road geometry and invalid Road markers.
- Browser acceptance compares target-cell pixels before Preview, during Preview, and after Commit so off-screen geometry cannot satisfy the visibility gate.

## Merge gate

Lean CI and complete Chromium/WebGL verification must pass on the exact PR head before this fix is eligible to merge.
