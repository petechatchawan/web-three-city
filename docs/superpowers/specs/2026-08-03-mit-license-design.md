# MIT License Adoption Design

## Status

Approved direction: adopt the standard MIT License for `web-three-city`.

## Purpose

Make the repository's licensing explicit while keeping the project permissively reusable. The project source code remains copyrighted by its owner and is licensed to others under the MIT License.

## Copyright holder

Copyright (c) 2026 Pete Chatchawan

## Scope

This change will:

1. Add the unmodified standard MIT License text at the repository root as `LICENSE`.
2. Add `"license": "MIT"` to the root `package.json`.
3. Add a concise License section to `README.md` that links to `LICENSE` and identifies Pete Chatchawan as the copyright holder.

## Explicit decisions

- No noncommercial restriction.
- No copyleft or share-alike requirement.
- No additional trademark, game-name, logo, branding, or publicity restrictions.
- No custom additional terms.
- No source-file license headers in this change.
- Third-party dependencies and assets remain governed by their own licenses.

## Verification

- `LICENSE` exactly matches the standard MIT License text except for the year and copyright holder line.
- Root `package.json` remains valid JSON and declares `"license": "MIT"`.
- README links to the repository license without contradicting the MIT grant.
- The change contains documentation and package metadata only; no runtime behavior changes.
