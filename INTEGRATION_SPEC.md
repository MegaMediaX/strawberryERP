# Telephony ↔ CRM Integration Spec (for the CRM developer)

This document is a **complete, standalone brief**. It describes the telephony side that is
already set up, and defines exactly what the **CRM must implement** to integrate.

---

## 1. Overview / architecture

```
 Yeastar P550 PBX (192.168.10.150, SIP)        Windows PC (same LAN)
 ─────────────────────────────────────         ─────────────────────────────────────────────
 Extension 1001  ◄── SIP register ──────────►   tinyphone  (open-source PJSIP softphone)
                                                 • headless, HTTP API on http://127.0.0.1:6060
                                                        ▲  dial / call-state
                                                        │
                                                 Integration middleware (Node.js, this repo)
                                                 • callTracker.js  → derives call outcomes
                                                 • tinyphoneDialer.js → auto-dialer
                                                        │  HTTP POST (call activity JSON)
                                                        ▼
                                                 ►►►  CRM  (what YOU build the endpoint for) ◄◄◄
```

- **Softphone:** `tinyphone` v36.0.0.85 (open-source, PJSIP). Installed at
  `C:\Program Files (x86)\Tinyphone\tinyphone.exe`. **No GUI** — headless, controlled via REST.
- **SIP account:** registered to the PBX as extension **1001** (account name `1001@192.168.10.150`), transport UDP, status `OK`.
- **PBX:** Yeastar P550, `192.168.10.150`, currently on the **free Basic plan** (so the paid
  Yeastar OpenAPI/CDR is NOT used; call data is derived from tinyphone instead).
- **Middleware** (Node ≥18, zero-dep) already polls tinyphone and produces a **normalized call
  record**. Your job on the CRM side is to **receive that record** (and optionally expose
  click-to-call). You do NOT need to talk to the PBX or tinyphone directly.

---

## 2. tinyphone REST API (source of truth, http://127.0.0.1:6060)

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/` | – | Health → `{ "message":"Hi!", "version":"36.0.0.85" }` |
| GET | `/accounts` | – | Registered SIP accounts + status |
| POST | `/login` | `{username, login, password, domain}` | Register a SIP account |
| POST | `/dial` | `{uri, account}` | Place a call (click-to-call) |
| GET | `/calls` | – | Live calls with state + duration |
| POST | `/calls/{id}/hangup` | – | Hang up one call |
| POST | `/hangup_all` | – | Hang up all |
| POST | `/calls/{id}/answer` | – | Answer inbound |
| POST | `/calls/{id}/dtmf/{digits}` | – | Send DTMF |
| WS | `/events` | – | Realtime events (format undocumented; **prefer polling `/calls`**) |

### Dial example
```http
POST http://127.0.0.1:6060/dial
Content-Type: application/json

{ "uri": "sip:03123456@192.168.10.150", "account": "1001@192.168.10.150" }
```
Response: `{ "account":"1001@192.168.10.150", "call_id":1, "message":"Dialling", "party":"sip:03123456@192.168.10.150", "sid":"<uuid>" }`

### GET /calls — the call-state model (this is how outcomes are derived)
```json
{
  "calls": [
    {
      "account": "1001@192.168.10.150",
      "callerId": "1099",
      "direction": "OUTGOING",            // or "INCOMING"
      "displayName": "",
      "duration": 3,                       // seconds since call CREATED (not talk-only)
      "hold": "NOT_IN_HOLD",
      "id": 1,                             // numeric id for hangup
      "party": "sip:1099@192.168.10.150",
      "sid": "230b205d...",                // stable unique call id
      "state": "CALLING"                   // CALLING → CONFIRMED (answered) → (gone = ended)
    }
  ],
  "count": 1,
  "message": "Current Calls"
}
```

**Outcome derivation (implemented in the middleware, documented here for clarity):**
- Call appears with new `sid` → **started** (`started_at = now`).
- `state == "CONFIRMED"` → **answered** (`answered_at = now`).
- `sid` disappears from `/calls` → **ended** (`ended_at = now`).
- `outcome = answered_at ? "answered" : "rang_no_answer"`.
- `ring_seconds = (answered_at || ended_at) − started_at`
- `talk_seconds = answered ? ended_at − answered_at : 0`
- `duration_seconds = ended_at − started_at`

---

## 3. THE CONTRACT — what the middleware sends to the CRM

For **every completed call** (inbound + outbound on ext 1001), the middleware POSTs this JSON
to a CRM endpoint. **Build an endpoint that accepts this** (field names are adjustable — tell us
your preferred names and we map them):

```json
{
  "external_id": "230b205d6b444156a633be126cd97ffa",   // unique call id — use for idempotent upsert
  "direction": "outbound",                              // "outbound" | "inbound"
  "from_number": "1001",
  "to_number": "03123456",
  "contact_number": "03123456",                          // the external party (dedupe/lookup key)
  "outcome": "answered",                                 // "answered" | "rang_no_answer"
  "answered": true,
  "ring_seconds": 5,
  "talk_seconds": 42,
  "duration_seconds": 47,
  "started_at": "2026-07-02T09:15:03.000Z",              // ISO-8601 UTC
  "recording_file": null
}
```

### What the CRM developer needs to provide/build
1. **A "log call" endpoint**, e.g. `POST /api/calls`, that:
   - accepts the JSON above,
   - **upserts by `external_id`** (idempotent — the same call may be sent more than once),
   - optionally links the call to a contact/lead by `contact_number`.
2. **Auth**: tell us the method — `Bearer <token>`, `X-API-Key`, Basic, or none — and issue a token.
3. **(Optional) contact upsert endpoint**, e.g. `POST /api/contacts` `{ "phone": "...", "name": "..." }`,
   to auto-create leads for unknown numbers.
4. **(Optional) click-to-call from the CRM UI**: to let a CRM button place a call, either
   - call the middleware (we can expose `POST /call {number}`), or
   - POST directly to tinyphone `/dial` (see §2) if the CRM runs on the same LAN/PC.

Return the endpoint base URL + auth token + (optional) your field names, and we finish wiring in
`config.json` (`crm` block) and `src/crmAdapter.js` (`logCall()` body mapping).

---

## 4. Environment facts (for reference)

| Item | Value |
|------|-------|
| PBX | Yeastar P550, `192.168.10.150`, SIP UDP 5060, Basic (free) plan |
| Extension | `1001` (SIP auth user `hNvXWT3yju`) |
| tinyphone API | `http://127.0.0.1:6060` (localhost only) |
| tinyphone account name | `1001@192.168.10.150` |
| Middleware | Node.js ≥18, `yeastar-crm-integration/` (callTracker.js, tinyphoneDialer.js, crmAdapter.js) |

## 5. Constraints / notes the CRM dev should know
- tinyphone + middleware run **on one Windows PC on the LAN**; the API is bound to `127.0.0.1`.
  If the CRM is cloud-hosted, the middleware makes **outbound** HTTPS calls to the CRM (CRM does
  not need to reach into the LAN).
- Call data covers **only extension 1001's own calls** (this softphone). Whole-PBX CDR would
  require the paid Yeastar OpenAPI (Standard+ plan) — out of scope here.
- **External outbound calls** currently fail at the PBX (no outbound route/trunk/permission for
  1001 yet). Internal extension-to-extension calls work. This is a PBX config item, independent
  of the CRM integration.
- **Idempotency is required** on the CRM side (dedupe on `external_id`).
- Timestamps are **UTC ISO-8601**.
```
