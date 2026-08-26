# ADR-0004: Simulation Calendar and Playback Standard

**Status:** Superseded by ADR-0005  
**Date:** `2026-08-25`  
**System:** `simulation-time`

## Context

This record captured the pre-successor proposal while PR #83 still needed to stabilize the temporal system. At that time the active calendar projected 24 hours/day, 30 days/month, and 12 months/year, and the proposal explored a compressed calendar plus slower 3.0/1.5/0.75-second playback.

## Historical Proposed Decision

The proposal evaluated:

- 60 game minutes per hour;
- one 24-hour simulation cycle per calendar month;
- 12 calendar months per year;
- proposed pacing of 3.0, 1.5, and 0.75 real seconds per GameMinute at x1/x2/x4.

`AbsoluteGameMinute` remained the intended sole authority; calendar values were projections; Traffic quanta remained staged inside one atomic minute.

## Why It Was Deferred

The proposal could not be implementation authority until RCI age/lifecycle, Economy, Save migration, performance, and owner UX policy were reviewed together. In particular, the existing 360-day RCI year and the proposed slower playback needed explicit treatment.

## Supersession

ADR-0005 is now Accepted and supersedes this proposal. The successor keeps the compressed calendar but **rejects the 3.0/1.5/0.75 playback table**, retaining merged nominal 1.0/0.5/0.25-second pacing instead. ADR-0005 also defines the RCI/calendar migration constraints.

This file remains historical evidence and is not implementation authority.