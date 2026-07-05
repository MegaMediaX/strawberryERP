# Improving Sales-Agent Efficiency — Research & Recommendations (2026-07-04)

Scope: the LebTech Partner Platform sales persona (Next.js portal, dev-store mode, telephony
per ADR 0001). This report is grounded in the actual flow (traced 2026-07-03/04) and the
click-path audits, mapped to established inside-sales efficiency levers. Recommendations are
prioritized by impact × effort and tied to metrics the shipped call-KPI dashboard can already
measure.

Efficiency for an inside-sales agent is basically: **maximize productive talk time, minimize
everything else** (dialing, waiting, researching, data entry, deciding who to call next). Every
lever below attacks one of those non-productive buckets.

---

## 1. Where agents lose time today (diagnosis from the flow)

| Time sink | Evidence in the product | Efficiency cost |
|---|---|---|
| Manual dialing / no live dialer | `Call via CRM` is simulated (`TELEPHONY_LIVE_DIAL` off); agents fall back to reading the number and dialing by hand | Dialing + wait is the single biggest non-talk bucket in inside sales |
| Two-step disposition on first contact | From `New Lead (Uncontacted)` the matrix blocks Interested/Not-Interested/Call-Later (FLOW-S1/S2) | Extra clicks on the most common outcome (a first call that connects) |
| No auto-advance after logging | Agent logs an outcome, then manually clicks "Next lead →" | A few seconds × hundreds of calls/day |
| Context missing in the queue | Calling queue drops call history + notes attribution (FLOW-S3) | Agent re-researches or calls blind |
| Notes evaporate | `Save note` is echo-only in dev-store (FLOW-S4) | Re-entry / lost context on the next touch |
| Manual "who do I call next?" | Queue is "next-best-first" but the ranking is static | Agents spend judgment cycles instead of dialing |
| Follow-up leakage | Scheduling is manual; no automated cadence/nudges | Warm leads go cold, lowering conversion-per-hour |

---

## 2. Efficiency levers, mapped to concrete changes

### A. Cut the dialing tax (highest impact)
> Note: Lebanon landline-only is **correct by design** — the real dialer data is landlines only,
> so the policy is not a blocker and should not be widened. The dialer levers below stand on their
> own.
1. **Go live on click-to-call.** Wire the middleware to `/api/calls/dial/next` + set
   `TELEPHONY_LIVE_DIAL=true`. Eliminates hand-dialing and mis-dials.
2. **Guard against double-dials first (DIAL-R1).** Add dedupe/debounce before live mode, or a
   power dialer will place duplicate real calls.
3. **Power-dialer mode in the calling queue.** After a disposition, auto-advance AND auto-place the
   next dial (with a short cancel window). This is the classic 2–3× talk-time lever — the queue
   already exists (`SalesCallingQueue`); it needs auto-advance + auto-dial wiring.
4. **Local presence (later).** Dial from a Lebanese local caller-ID to lift answer rates.

### B. Fewer clicks per call
6. **Fix the first-call transition trap (FLOW-S1).** Allow `Uncontacted → Interested / Not
   Interested / Scheduled`, or hide invalid one-tap outcomes. Turns the most common outcome from
   two steps into one.
7. **Auto-advance after "Save outcome".** In the queue, a successful disposition should advance.
8. **One-screen disposition.** Keep outcome + follow-up date + note on one view so a call is logged
   without scrolling/second screens (mostly there; tighten the queue variant).

### C. Better "who to call next" (protect judgment cycles)
9. **Lead scoring for queue order.** Rank by: follow-up due/overdue, priority (VIP/High), speed-to-
   lead (freshest new leads first), fewest prior attempts, best time-of-day. The ordering hook is
   already the seam (`leads pre-ordered next-best-first`); make the ranking data-driven.
10. **Speed-to-lead surfacing.** A "new leads, call now" widget — contacting a fresh lead quickly is
    one of the strongest conversion levers; the dashboard widgets are the natural home.

### D. Kill re-work / data entry
11. **Persist notes (FLOW-S4)** — add `notes` to `LeadOverride` (dev-store) so context survives.
12. **Auto-log every call** — already happens via the `CallRecord` ingest; ensure the timeline in
    the *queue* shows it (FLOW-S3) so agents see history without leaving the screen.
13. **Expand quick note templates + outcome reasons** — capture structured reasons in one tap.

### E. Cadences & no-leakage follow-up
14. **Automated follow-up cadences.** When a call ends "No Answer" or "Call Later," auto-schedule
    the next attempt on a configurable cadence and surface it in Follow-Ups. Reduces manual
    scheduling and stops warm leads going cold.
15. **Retry logic on no-answer** — bounded auto-retries at varied times of day.

### F. Coaching & targets (compounding, low effort — you already built the data)
16. **Use the call-KPI dashboard for targets & coaching.** The shipped `/admin/reports/call-center`
    already computes calls made, answer-rate, avg/total talk, calls/day, active agents. Set
    per-agent targets, spot low answer-rate or low calls/day agents, and coach. This is the cheapest
    efficiency win because the measurement is already live.
17. **Per-agent leaderboard + streaks** — lightweight gamification off the same KPI lib.
18. **Whisper/barge/call-recording review (later)** — once live dialing + recordings are flowing.

---

## 3. Prioritized roadmap (impact × effort)

**Do first — quick unblocks (high impact, low effort):**
- Add redial dedupe/debounce (§A2) — prerequisite for anything auto.
- Fix the first-call transition trap (§B6).

**Next — the talk-time multiplier (high impact, medium effort):**
- Live click-to-call (§A1) + power-dialer auto-advance/auto-dial (§A3, §B7).
- Show call history + persist notes in the queue (§C/D: FLOW-S3, FLOW-S4).

**Then — smarter targeting & no-leakage (high impact, medium/high effort):**
- Data-driven lead scoring for queue order + speed-to-lead widget (§C9, §C10).
- Automated follow-up cadences + no-answer retries (§E14, §E15).

**Always-on — measure & coach (compounding, low effort):**
- Targets, leaderboard, and weekly review off the existing call-KPI dashboard (§F16, §F17).

---

## 4. Metrics to track (all computable from the shipped KPI lib)

Efficiency is only "improved" if these move. The `call-kpis` lib + dashboard already expose most:

- **Talk time per agent per day** (the north-star for dialer changes) — `totalTalkSeconds`.
- **Calls made / day** — `callsPerDay`.
- **Answer rate %** — `answerRatePct` (local presence / time-of-day levers).
- **Avg talk time** — `avgTalkSeconds` (quality guardrail so "more calls" doesn't mean rushed).
- **Conversion per call / per hour** — join dispositions → converted leads (new metric, small add).
- **Speed-to-lead** — time from lead assignment to first call attempt (new metric).
- **Follow-up adherence** — scheduled follow-ups completed on time.
- **Unlinked-call rate** — `unlinkedCount` (data hygiene; unlinked calls = lost attribution).

Baseline these now (pre-change), then compare after each roadmap item — the dashboard's date-range
filter makes before/after windows trivial.

---

## 5. Notes / limits of this report

- This is grounded in the codebase + established inside-sales practice, not external benchmark
  studies. Directional claims (e.g. "power dialers multiply talk time," "speed-to-lead lifts
  conversion") are well-established mechanisms; exact uplift depends on your book, hours, and
  answer rates — measure with §4 rather than assuming a headline number.
- The dependency order matters: the dialer levers (§A) are gated on `TELEPHONY_LIVE_DIAL` + a live
  middleware — confirm those operationally before building power-dialer UX on top. (Lebanon
  landline-only is intended and stays; the real dialer data is landlines.)
- If you want an externally-sourced, cited version (industry benchmarks for dialer talk-time
  uplift, speed-to-lead curves, cadence best practices), that's a separate deep-research pass.
