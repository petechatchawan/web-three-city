# Task 7 — Mobility Schedule Policy V2

Implemented deterministic V2 commute schedule policy in `citizen-mobility-core`: stable weighted 07:00–08:59 work-start distribution, bounded deterministic morning/return jitter, and compatibility alias behavior. No randomness or mutable schedule state was introduced.

TDD evidence: focused V2 schedule tests were RED because the exports and V2 behavior were absent, then GREEN with 18 passing tests. Owning package tests and typecheck passed under Node 22.23.2.
