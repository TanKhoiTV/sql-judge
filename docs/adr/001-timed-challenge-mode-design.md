# ADR 001: Timed Challenge Mode Design (v0.10.0)

**Status:** Draft for review  
**Date:** 2026-06-04  
**Deciders:** @TanKhoiTV  

---

## Context

The SQL Judge project needs a timed challenge mode that extends the existing practice/sandbox modes with time pressure, randomized questions, and performance metrics. The state foundation (Phase 1) is complete — `getState`/`setState`/`events.on` provide the integration boundary.

### User Requirements

1. **Customizable metrics** — Choose what's tracked: time per question, total time, accuracy, attempts, streak, score, questions passed
2. **Random questions** — Exercises selected in random order with difficulty-weighted probability
3. **Presets** — Pre-defined configurations for different challenge types

### Constraints

- Inline implementation in app.ts first (per advisor wisdom), extract to `ext/timed-mode/` later
- No LIMIT/TOP, recursive CTEs, window functions, COALESCE, SUBSTR in exercises
- Hard label = Medium++ (more complexity, not new techniques)
- Timer must use `Date.now()` not interval counting (handles tab-backgrounding)

---

## Design Decisions

### Decision 1: Scoring System

**Options considered:**
- **A.** 10/5/0 (1st try=10, later try=5, skip/timeout=0) + streak multiplier
- **B.** 10/5/0 without streak multiplier
- **C.** Points proportional to difficulty (Easy=5, Medium=10, Hard=15)

**Open question:** Does 10/5/0 + streak multiplier feel right, or simpler?

### Decision 2: Preset Balance

**Proposed presets:**
| Preset | Qty | Time/Q | Total | Difficulty Bias | Pass Criteria |
|---|---|---|---|---|---|
| ⚡ Quick Quiz | 5 | 3min | 15min | Easy 3×, Med 2× | score ≥ 30 |
| 📋 Standard | 10 | 5min | 50min | 1× each | accuracy ≥ 60% |
| 🏃 Marathon | 50 | none | 120min | 1× each | pass_count ≥ 30 |
| 🔥 Hard Only | 8 | 8min | 64min | Hard only | accuracy ≥ 50% |
| 🚀 Speed Run | 10 | 2min | 20min | Easy+Med | score ≥ 70 |
| 🛠 Custom | variable | variable | variable | all controls | configurable |

**Open question:** Any presets to add, remove, or adjust?

### Decision 3: Setup UX

**Options considered:**
- **A.** New "Challenge" tab alongside Practice/Sandbox in the topbar
- **B.** Modal triggered from the practice view
- **C.** Dedicated page/route

**Open question:** Tab vs modal vs separate page?

### Decision 4: Metric Toggle Semantics

**Options considered:**
- **A.** Disabled metrics still computed internally for scoring, just not displayed (current design)
- **B.** Disabled metrics truly excluded — scoring ignores them

**Open question:** When a metric toggle is off, should it still affect scoring?

### Decision 5: Per-Question Timeout Behavior

**Options considered:**
- **A.** On timeout, mark `timed_out`, award 0 points, advance to next question
- **B.** On timeout, allow the user to continue but mark as overtime (reduced points)
- **C.** On timeout, end the entire session

**Open question:** What should happen when a per-question timer expires?

### Decision 6: Preset Adjustability

**Options considered:**
- **A.** Presets are fixed; only "Custom" allows changes (current design)
- **B.** All presets are adjustable — selecting a preset loads its config, but user can tweak any field
- **C.** Hybrid: presets are fixed, but a "Customize" button copies preset values into custom controls

**Open question:** Should non-Custom presets be adjustable?

---

## Technical Architecture

### State Model

A single `timedChallenge` field on AppState (null when idle) containing:
- `config`: preset name, question count, time limits, difficulty weights, metric toggles, passing criteria
- `phase`: idle → setup → running → feedback → results → idle
- `questions[]`: per-question state (exercise ref, status, attempts, time, score)
- `metrics`: session-level aggregation
- Timer tracking fields

### Randomization

Weighted reservoir algorithm:
1. Group exercises by difficulty
2. Multiply each group by its weight (Easy:3 = each Easy exercise appears 3×)
3. Fisher-Yates shuffle
4. Deduplicate taking first occurrence → first N are the session questions

### Integration

- ~20 new functions in app.ts with `timed` prefix (~500-700 lines)
- 7 new events on the event bus (`timed:phase-changed`, `timed:tick`, etc.)
- Timer uses `Date.now()` differences for accuracy across tab backgrounding
- Judge uses existing `compareResults` from lib.ts
- Score recording still calls `recordAttempt()` for localStorage progress

### Future Extraction Boundary

When timed mode exceeds ~800 lines, extract to `ext/timed-mode/`:
```
ext/timed-mode/
├── timed-presets.ts
├── timed-state.ts
├── timed-select.ts
├── timed-timer.ts
├── timed-ui-setup.ts
├── timed-ui-hud.ts
├── timed-ui-question.ts
├── timed-ui-feedback.ts
├── timed-ui-results.ts
└── index.ts
```

The event bus and state API are the natural boundary — the module reads/writes state and emits custom events, requiring no app.ts changes beyond registering the init call.

---

## Open Questions (Pending User Input)

1. Scoring: 10/5/0 + streak multiplier, or simpler?
2. Presets: Any additions/removals/adjustments?
3. Setup UX: Challenge tab vs modal vs separate page?
4. Metric toggles: Excluded from display only, or truly excluded from scoring?
5. Timeout: Advance, continue overage, or end session?
6. Presets: Fixed, adjustable, or hybrid?
