# Redial + Sales-Agent Flow Audit — 2026-07-04

Focused behavioural audit of the click-to-call ("redial") command channel and the sales agent's
calling loop. Code traced end to end (`/api/calls/dial`, `/api/calls/dial/next`,
`/api/calls/disposition`, `src/lib/telephony/dial.ts`, `dev-store` dial queue + lead overrides,
`LeadCallScreen`, `SalesCallingQueue`) and exercised live in the browser (dev-store mode,
logged in as the seeded Sales user `rami@beirutdigital.example`).

**10 findings — 1 HIGH · 4 MEDIUM · 5 LOW.** Most HIGH/MEDIUM redial issues are latent because
live dialing is off (`TELEPHONY_LIVE_DIAL` unset → every dial resolves as `simulated`, no real
call); they become real the moment the trunk is provisioned and the flag flips.

Live-exercised: DIAL-R1 (5 concurrent redials → 5 commands), country-block 403, no-number 400,
out-of-scope 404, disposition persistence (page vs API divergence).

---

## Redial / click-to-call channel

**DIAL-R1 [HIGH — live mode] — No dedupe / rate-limit / debounce → duplicate real calls.**
`POST /api/calls/dial` enqueues a distinct command per request with no idempotency. Verified: 5
concurrent redials to the same lead+number → 5 separate commands, all `202`, distinct ids. The UI
button only guards a single in-flight request (`disabled={dialBusy}`, cleared in `finally` on the
fast 202), so rapid clicks slip through. In simulated mode the commands are terminal and harmless;
in live mode the middleware would pull and dial the customer **5 times**. Unlike the call-ingest
route (`/api/calls`, which has per-key rate limiting), the dial route has none.
Fix: dedupe by lead/number while a command is `queued`/`claimed`, debounce the button, and/or a
short server-side idempotency window.

**DIAL-R2 [MEDIUM — live mode] — Optimistic "placing the call" before anything is claimed.**
On the 202 the UI shows *"Dialing {number} — the softphone is placing the call."*
(`LeadCallScreen.dialViaCrm`, `body.live` branch), but the command is only `queued` — the
middleware hasn't pulled or dialed it. If the middleware is down it never dials and no failure
surfaces; the agent believes a call is happening. Fix: report "Queued — waiting for the softphone"
until a `claimed`/`completed` result is polled back.

**DIAL-R3 [MEDIUM — live mode] — Claimed dials never time out or re-queue.**
`claimNextDial` flips `queued → claimed`; nothing ever reverts a `claimed` command. If the
middleware claims then crashes before reporting, the command is stuck `claimed` forever — the
customer is never called and nothing surfaces. Fix: a claim TTL that returns stale `claimed`
commands to `queued` (or marks them `failed`).

**DIAL-R4 [LOW] — `resolveDial` has no idempotency / terminal guard.**
`resolveDial(id, status)` re-maps any matching command regardless of its current state. A duplicate
middleware report (network retry) re-resolves an already-terminal command and writes a **second**
`dial_result` audit entry; it will also "resolve" a command that was never `claimed`.
Fix: only transition from `claimed`; ignore ids already in a terminal state.

**DIAL-R5 [LOW] — `dialQueue` grows unbounded.**
The queue is enqueue-only (`unshift`); `resolveDial` maps in place and nothing prunes terminal
commands. Every dial — including every simulated redial — accumulates for the server's lifetime
(memory-only in dev-store, resets on restart, but an unbounded-growth smell and it slows
`claimNextDial`'s linear scan). Fix: cap/prune resolved commands.

---

## Sales-agent calling flow

**FLOW-S1 [MEDIUM] — One-tap outcomes error on a fresh (Uncontacted) lead** (re-confirms S-002).
The transition matrix (`lead-workflow.ts`) allows `New Lead (Uncontacted)` → only
`Attempted Contact` / `Awaiting Response`. So when a **first call connects**, the one-tap
"Interested" / "Not Interested" / "Call Later" buttons throw *"Cannot move a lead from New Lead
(Uncontacted) to …"* — exactly the happy-path outcomes of a redial that reaches someone. Only
"No Answer" works first-call. The buttons stay enabled (no disabled/hidden state for invalid
targets). Verified via matrix + prior live repro. Fix: allow Uncontacted → Interested/Not
Interested/Scheduled (product decision), or disable/hide outcomes invalid for the current status.

**FLOW-S2 [MEDIUM — dev-store mode] — The `/api/frappe/leads` API ignores dev-store overrides.**
A disposition persists via `applyLeadOverride` and is merged back by `getUiLeads` — so the
server-rendered **sales lead page correctly shows the new status**. But `GET /api/frappe/leads`
reads the raw `leads` seed array (`filterByPermission(leads.map(...))`) and never merges
`leadOverrides`, so it returns the **stale** status. Verified live: after a "No answer"
disposition, the lead page shows `Attempted Contact (No Response)` ✓ while the API still returns
`Scheduled Follow-Up` ✗. Two read paths disagree — any client `fetch('/api/frappe/leads')` or
external API-key consumer sees pre-call state. (In production Frappe mode both proxy Frappe, so
this is a dev-store-only divergence — but it's a silent source-of-truth split and a debugging
trap.) Fix: merge `leadOverrides` in the leads GET route, same as `getUiLeads`.

**FLOW-S3 [LOW] — Calling queue drops call history + attribution.**
`SalesCallingQueue` renders `<LeadCallScreen timeline={buildTimeline(lead)} …>` with **no** call
records (the standalone lead page passes `buildTimeline(lead, leadCalls)`) and no `users`, so
inside the queue: the activity timeline never shows prior calls, saved notes attribute to "You",
and Reassign is unavailable. Inconsistent with the standalone lead view for the same lead.
Fix: pass the lead's call records and the user list into the queue's LeadCallScreen.

**FLOW-S4 [LOW] — "Save note" is echo-only** (carryover S-005).
`saveNote` PATCHes `/api/frappe/leads {notes}`, which is echo-only in dev-store — `LeadOverride`
has no `notes` field, so the note shows optimistically ("Note saved.") but is gone on reload,
unlike status which persists. Fix: add `notes` to `LeadOverride` + merge it, or route notes
through a persisting endpoint.

**FLOW-S5 [LOW] — Call-screen flow carryovers** (from the 2026-07-03 audit, still open):
"Wrong Number" records nothing anywhere (S-010); a `followUpDate` picked for "Call Later" leaks
into a later non-scheduled outcome (S-011); a lead already in `Scheduled Follow-Up` has no path to
reschedule from the call screen — the date field only appears when *entering* Scheduled and Save is
disabled when `!dirty` (S-016).

---

## Confirmed correct (no bug)

- Country-block on dial: `+972…` (Israel) → **403** "Dialing this country is blocked" (validated
  server-side, never trusts the client).
- Dial validation: missing number → **400**; lead outside caller scope → **404**.
- Disposition scope + persistence: writes `applyLeadOverride` and is visible on the lead page;
  `No answer`/`Interested`/`Not interested`/`Callback scheduled` all map to valid transitions and
  route through the persisting disposition endpoint (not the echo-only leads PATCH).
- FIFO claim order: `enqueueDial` unshifts (newest first) and `claimNextDial` scans from the tail
  (oldest first) — correct FIFO despite the reversed storage.
- Dial-command ids are unique under burst (`DIAL-${Date.now()}-${queueLength}`; length is
  monotonic within a session).
- Simulated dials are terminal (`simulated`), so the middleware `GET /dial/next` never claims them
  — only genuine live `queued` commands are pulled.
