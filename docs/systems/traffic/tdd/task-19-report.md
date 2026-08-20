# Task 19 — Presentation Authority Cutover

Traffic presentation now materializes only currently authoritative active Mobility-linked Traffic trips. Completed trips are released without replay or renderer-owned arrival tails. Stable pooled identity, prepared routes, interpolation, LOD, and transform-only frame sampling remain presentation concerns; canonical lifecycle, ordering, headway, admission, reservations, and arrival are consumed from committed Traffic state.

TDD evidence: presentation authority tests were RED against receipt/replay and absent-active fallback behavior, then GREEN with the Game presentation tests and `traffic-three` tests/typecheck passing. No presentation update mutates canonical Traffic or Mobility state.
