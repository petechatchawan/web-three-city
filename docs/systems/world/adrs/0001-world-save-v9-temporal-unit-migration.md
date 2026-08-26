# ADR-0001: WorldSaveV9 Temporal Unit Migration

**Status:** Superseded by ADR-0002  
**Date:** `2026-08-25`  
**System:** `world`

## Context

This record established the initial WorldSaveV9 direction before the compressed-calendar cutover was approved. It correctly identified the need for semantic temporal field names, envelope-level unit discrimination, compact integer timestamps, V1–V9 read compatibility, and a V9-only canonical writer.

## Historical Decision

The original proposal specified:

- new Simulation/Building/RCI/Economy/Mobility/Traffic codecs;
- one envelope temporal-standard discriminator;
- Simulation V1/V2 hour ticks migrated with checked `*60`;
- Building/RCI/Economy Tick values treated as macro-hour 1:1;
- Mobility GameMinute and Traffic transport-second values treated 1:1;
- legacy calendar mapping left unchanged in V9.

The blanket RCI 1:1 assumption was intentionally subject to later semantic proof.

## Supersession

ADR-0002 is now Accepted and supersedes this record. It keeps the explicit-unit/V9 architecture but also adopts `calendarPolicyVersion = 1`, authority-continuity migration for `AbsoluteGameMinute`, and field-sensitive RCI migration. In particular, RCI age-origin timestamps are rescaled so the new 12-cycle year does not make legacy citizens approximately 30x older.

This file remains historical evidence and is not implementation authority.