# ADR 0001 — Auto-dialer + call-logging integration into the Sales UI

- **Status:** Accepted (design only — no implementation yet; awaiting go-ahead)
- **Date:** 2026-07-02
- **Deciders:** 8-specialist panel (backend, Next.js, security, telephony/SIP, data, DevOps, QA, product) + PM gate
- **Source of truth for the telephony side:** [`INTEGRATION_SPEC.md`](../../INTEGRATION_SPEC.md)
- **Scope:** How the LebTech Partner Platform (Next.js 16 / TS, dev-store/hooks-only mode,
  Frappe backend dark, Dockerized on a Hostinger VPS) integrates an on-prem softphone
  auto-dialer and automatic call-logging into the Sales UI (`src/app/sales`).

> This is an architecture decision record. **No application code is changed by this
> document.** Implementation proceeds only after human go-ahead, phase by phase.

---

## Context

The telephony side is already built: **tinyphone** (headless PJSIP softphone, REST at
`http://127.0.0.1:6060`) runs on a **LAN Windows PC**, registered to a **Yeastar P550**
PBX as **SIP extension 1001**. A **Node middleware** on that PC polls tinyphone, derives
call outcomes, and **POSTs a normalized completed-call record** to a CRM endpoint
(`external_id`, `direction`, `contact_number`, `outcome` = `answered|rang_no_answer`,
`ring/talk/duration_seconds`, `started_at` ISO-UTC, `recording_file`).

Four hard constraints shaped every decision:

1. **External outbound calls currently FAIL at the PBX** — ext 1001 has no trunk/outbound
   route. Only internal/inbound calls work today, so **click-to-dial is inert** until the
   PBX is provisioned. (PBX config is **outside this project.**)
2. **NAT + cloud topology** — the CRM is cloud-hosted; the office LAN is behind NAT.
   Inbound to the LAN is blocked; the middleware can only make **outbound** calls to the CRM.
   A browser on an HTTPS page **cannot** reach `http://127.0.0.1:6060` (mixed-content, and
   `127.0.0.1` is the wrong machine anyway).
3. **One extension (1001) today** — effectively a single shared line (one concurrent call).
   Per-user extensions later mean **one middleware per PC**.
4. **Country block (IL/ISR)** is a platform invariant that must hold on both logging and dialing.

Existing platform patterns to **reuse** (verified in-repo): API-key auth
(`authorizeApiRequest`/`evaluateApiKeyPermission`, `X-API-Key`, scrypt-hashed, prefix-only
lookup, `ApiScope` enum), `appendApiLog`, `appendAudit` → `activityTimeline`, dev-store
helpers + `upsert*`, `getUiLeads`/`getUiRows` role/reseller/country scoping, the
no-DELETE/405 boundary, and the country-block invariant. The Sales calling screen already
exists: `src/app/sales/calling` renders `<SalesCallingQueue leads={orderLeadsForCalling(...)}>`.

---

## Decisions

### A. Call data model — dedicated `CallRecord` entity, rendered via the existing timeline
A `CallRecord` is the **source of truth** (unique key `external_id`; typed fields; indexes on
`external_id`, `contact_number`, `lead`, `reseller`, `started_at`). It is **surfaced in the
UI through the existing lead activity timeline** (`buildTimeline`) as a `call` entry — **not**
a separate panel. Productivity metrics use **`talk_seconds`**, never `duration_seconds`
(which is ring+talk and silently inflates "productivity"). Frappe seam = a `CallRecord`
DocType mirroring the dev-store shape (drop-in later).

*Why (contested — see scoring below):* the panel split between a dedicated entity (backend +
data architect: real upsert key, indexes, analytics at 10k scale) and reusing
`activityTimeline` (frontend: avoid duplicate UI/state). These reconcile: the entity is the
data layer; the timeline is the **derived view**. Both hills satisfied.

### B. Middleware → CRM auth — reuse the platform API-key with a new least-privilege scope
Add a `write:calls` scope; the middleware key holds **only** that (no lead/roster read). Over
the public internet, add an **HMAC-SHA256 body signature** + **timestamp-freshness** check
(reject `started_at`/request skew beyond a window) + **per-key rate-limit**; `appendApiLog`
on every ingest. Rotation uses a **dual-key window** so key refresh never drops calls. A
separate bearer token was rejected: it doubles the secret-management, audit, and country-block
surface for no gain.

### C+E. Click-to-call + dialer topology — outbound-initiated command channel
**Never** browser→`127.0.0.1` and **never** VPS→LAN (both are non-starters — see below). The
**CRM owns the dial queue**; the **middleware long-polls the CRM** for the next dial command,
executes tinyphone `/dial` locally, and POSTs call state back. Flow:
`browser → CRM API route → CRM dial queue → middleware (long-poll pull) → tinyphone /dial`,
with state posted back and the **browser polling the CRM** for updates. The middleware stays a
**dumb, stateless relay**; all business logic (scoping, country-block, queue ordering) lives
in the CRM. This is the only pattern that survives NAT + TLS + mixed-content and extends to
multiple office locations.

### D. Live call state — polling, poller in the middleware
Polling, not WebSocket (tinyphone's WS `/events` is explicitly **undocumented**; the spec says
prefer polling). The **middleware** polls tinyphone (~1s) and is the single PBX-facing source
of truth; the **browser polls/SSE the CRM** (~2–5s). Outcome derivation must treat
"`sid` appeared and vanished between polls with no `CONFIRMED`" as a valid **`rang_no_answer`**
short-call record — **never a silently dropped event**.

### F. Data model scoping
`CallRecord` **denormalizes** `reseller`, `country`, `assigned_user` **copied-down** from the
linked lead/customer at link time (a live join per row kills the 10k-row target); **re-copy-down
on lead reassignment**. `contact_number`/`from`/`to` normalized to **E.164** once, at ingest.
**Unknown numbers land in an `unlinked` triage bucket** — auto-create-lead is **opt-in, off by
default** (avoids spam/wrong-number garbage leads). **Every `CallRecord` is tagged with
account/extension now** (forward-compat for per-user extensions). **Impersonation sessions may
VIEW but never PLACE calls** (a placed call is a real-world action, not a data read).

### G. Security / QA gates
**Idempotent upsert-by-`external_id` is the non-negotiable invariant** (duplicate POST →
exactly one record), proven by a **fake-tinyphone contract-test harness in CI**. Country-block
enforced **server-side on BOTH ingest and dial** (never trust the client). **No-DELETE** —
corrections happen via upsert only. `recording_file` path is validated/allowlisted (no
client-supplied path traversal); phone numbers + recordings treated as PII.

---

## Scored comparison — the two genuinely contested decisions

### Decision A — data model (1 = poor, 5 = strong)

| Option | Scale/query (×2) | UI simplicity | Frappe seam | Analytics fidelity | Weighted |
|---|---|---|---|---|---|
| **Dedicated `CallRecord` + timeline view (chosen)** | 5 | 4 | 5 | 5 | **28** |
| Encode calls as `activityTimeline` entries only | 2 | 5 | 2 | 2 | 15 |

Timeline-only forces JSON-parsing `newValue` for every analytics query and has no unique-index
surface for idempotency — disqualifying at the 10k-lead scale target.

### Decision C+E — click-to-call topology

| Option | Works through NAT | TLS/mixed-content safe | Remote-user support | Ops burden | Security | Weighted |
|---|---|---|---|---|---|---|
| **Outbound-initiated command channel (chosen)** | 5 | 5 | 5 | 4 | 5 | **24** |
| Browser → middleware on same LAN | 3 | 2 | 1 | 3 | 3 | 12 |
| Local companion app / browser extension | 5 | 5 | 4 | 2 | 3 | 19 |
| Browser → `127.0.0.1:6060` directly | 0 | 0 | 0 | 5 | 0 | **reject** |
| VPS → LAN `127.0.0.1` | 0 | 3 | 0 | 1 | 1 | **reject** |

The last two are physically impossible/insecure here: mixed-content + wrong-machine, and
NAT-blocked ingress into an **unauthenticated** local API (a confused-deputy / DNS-rebinding /
SSRF magnet).

---

## Rejected alternatives (summary)
- **Separate bearer token for the middleware** — second secret/rotation/audit surface; rejected for the scoped API-key.
- **WebSocket for live state** — undocumented tinyphone WS; rejected for polling.
- **Middleware owns the dial queue / business logic** — rejected; middleware stays a dumb relay, CRM owns workflow + scoping.
- **Auto-create a lead for every unknown number** — rejected as default (spam); opt-in triage instead.
- **Progressive/predictive dialing** — impossible on a single shared line; **preview-dial only**.
- **Ship click-to-call first** — rejected; it is PBX-blocked today and would read to reps as a broken feature. Logging ships first.

---

## Security & scoping implications
- New least-privilege `write:calls` (and `read:calls`) scope; middleware key scoped to it only.
- Ingest endpoint: HMAC signature + timestamp freshness + rate-limit + `appendApiLog` + `external_id` unique constraint.
- Country-block enforced server-side on ingest **and** dial; impersonation cannot place calls.
- No component reachable by the browser or public internet ever holds a route to tinyphone's unauthenticated `:6060`.
- PII: `contact_number` + `recording_file` access-scoped and audited; no client-supplied file paths.
- Scoping inherited copy-down from the linked lead; unlinked calls visible only to admin/owner until triaged.

---

## PM-approved phased plan

| Phase | Deliverable | Acceptance gate | Owner |
|---|---|---|---|
| **1. Automatic call logging** (~4 wk) | `CallRecord` model + `POST /api/calls` ingest; inbound/internal calls onto the lead timeline (`talk_seconds`) | Idempotent upsert-by-`external_id` proven by fake-tinyphone contract test in CI; country-block server-side; `write:calls` scope | Backend + QA |
| **2. Disposition capture + scoping** (~2 wk) | Disposition form (outcome/notes/next follow-up); copy-down reseller/country; E.164 normalize; `unlinked` triage bucket | HMAC + timestamp + rate-limit auth; `appendApiLog` every ingest; scoping tests green | Backend + Security |
| **3. Click-to-call (preview-dial)** (PBX provisioning + ~2 wk) | CRM dial queue + middleware long-poll command channel; browser polls CRM for state | **PBX outbound trunk provisioned for ext 1001 (external)**; browser never contacts `127.0.0.1`; dial audited | Backend + UI |
| **4. Auto-dialer (preview mode)** (~1 wk after P3) | Queue-driven preview dialing | Single-concurrent-call enforced server-side; country-block on dial; no-DELETE; retry-no-double-dial | Backend |
| **5. Per-user extensions** (~4 wk, post initial run) | One middleware per PC; user→extension binding | Extension tag on every `CallRecord`; user↔middleware registry DocType | Backend + DevOps |

## Top risks (from the PM gate)
1. **PBX trunk provisioning is an external blocker** for Phase 3 — click-to-dial is inert until the Yeastar admin provisions an outbound trunk/route for ext 1001. **Escalate ETA to the human.** Phases 1–2 proceed in parallel regardless.
2. **Middleware resilience under NAT** — if the CRM is unreachable, POSTs fail; needs exponential backoff + a local journal (SQLite/in-memory), retry window, and an alert after N consecutive failures.
3. **Idempotency under retry storms** — rapid duplicate POSTs of the same `external_id` must still yield exactly one record; the CI contract harness must prove this.

## Escalations to the human
1. **PBX trunk provisioning timeline** for ext 1001 (blocks Phase 3 only).
2. **Middleware host stability** — confirm the tinyphone/middleware PC is stable, backed up, monitored; add a recovery plan if it's a personal machine.
3. **Secret store + API-key rotation** — reuse the platform's managed-secret path; HMAC rotation needs a dual-key window to avoid middleware outages.

---

## Consequences
- **Positive:** value on day one from call-logging with zero PBX dependency; reuses existing auth/audit/scoping/timeline; NAT- and TLS-safe topology; clean Frappe migration seam; the risky click-to-dial is deferred behind a real external gate.
- **Negative / follow-ups:** copy-down scoping needs a re-copy-down on lead reassignment; a shared single line is a pilot-only constraint (messaged to reps) until per-user extensions; middleware becomes N-instances at that point (registry required); recording features must degrade gracefully while `recording_file` is null.
