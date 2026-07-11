# lebtech-mcp

Standalone MCP server (stdio) that lets an AI agent operate the **LebTech Partner
Platform** end-to-end **without any app-code change** — it wraps the existing
HTTP surfaces only (`src/` and `frappe_app/` are never touched).

- **Stack:** TypeScript, `@modelcontextprotocol/sdk` (stdio transport), zod, Node ≥ 20.
- **Location:** `tools/lebtech-mcp/` — self-contained npm package (own lockfile, not a workspace).

```bash
cd tools/lebtech-mcp
npm install
npm run build
npm test               # 42 unit tests incl. the full gate matrix
npm run inspect        # MCP Inspector against the built server
```

## Architecture — two tiers, independently gated

| Tier | Transport | Auth | Identity | Enabled by |
|---|---|---|---|---|
| **PORTAL** (default) | Next.js `/api/*` routes | Signed `lebtech_session` cookie, minted via HMAC-SHA256 from `PORTAL_SESSION_SECRET` (`base64url({sub,exp}).sig`, `exp` in epoch ms) | The portal user in `MCP_PORTAL_USER` (default `USR-SUPER`) — inherits the app's permission matrix, role scoping, and the `ADMIN_FRAPPE_WRITE_VERIFIED` quarantine | always |
| **FRAPPE** (admin/maintenance) | Frappe `/api/method/lebtech_partner_platform.api.*` | `Authorization: token key:secret` | Effectively **Administrator** — bypasses portal role scoping | `MCP_FRAPPE_TIER_ENABLED=true` |

Seed passwords are placeholders that 401 — cookie minting is the only supported
portal entry. The portal tier **never works around** app-side gates: a 501
(`BACKEND_NOT_CONFIGURED` / write quarantine) or 403 from the app is surfaced
verbatim as a structured failure.

The Frappe tier uses `undici.request` instead of `fetch` because `fetch` strips
custom `Host` headers, and the local Docker stack serves the named site
`lebtech.local` behind `127.0.0.1:8001`.

## Gate model

Mirrors the app's own flag-gate pattern (`TELEPHONY_LIVE_DIAL`,
`ADMIN_FRAPPE_WRITE_VERIFIED`). All gates default **OFF**.

| Gate | Effect |
|---|---|
| *(none)* | Read tools only (16 tools) |
| `MCP_WRITES_ENABLED=true` | Write tools register (35 tools) |
| `+ MCP_DESTRUCTIVE_ENABLED=true` | Destructive tools register; **each call additionally requires `confirm:true`** and echoes what it is about to do |
| `MCP_FRAPPE_TIER_ENABLED=true` | Frappe tier registers (reads; its writes/destructive still need the gates above). All on = 69 tools |

Gating is enforced twice: tools outside the gates are **not registered** at all,
and the runtime wrapper re-checks as defense in depth, returning a **structured
refusal** (`{ ok:false, refused:true, code, message, wouldHaveDone? }`) — never a
thrown error. Refusal codes: `WRITES_DISABLED`, `DESTRUCTIVE_DISABLED`,
`CONFIRMATION_REQUIRED`, `FRAPPE_TIER_DISABLED`.

## Environments

| | `MCP_TARGET=local` (default) | `MCP_TARGET=prod` |
|---|---|---|
| Portal | `http://127.0.0.1:3000` (Next dev server) | `https://strawberryerp.srv1259241.hstgr.cloud` |
| Frappe | `http://127.0.0.1:8001` + `Host: lebtech.local` (claudeerp-backend-1) | **no default** — explicit `FRAPPE_BASE_URL` required |
| Start-up guard | — | requires `MCP_PROD_CONFIRMED=true` or the server **refuses to start**; `PORTAL_BASE_URL` on port 3000 is rejected (different tenant on the shared box) |

## Environment variables

| Var | Required | Meaning |
|---|---|---|
| `MCP_TARGET` | no (`local`) | `local` \| `prod` |
| `MCP_PROD_CONFIRMED` | prod only | must be `true` for prod |
| `PORTAL_SESSION_SECRET` | **yes** | HMAC secret the app signs `lebtech_session` with |
| `MCP_PORTAL_USER` | no (`USR-SUPER`) | portal user id to act as |
| `MCP_SESSION_TTL_MINUTES` | no (60) | minted-cookie TTL |
| `PORTAL_BASE_URL` | no | override portal base URL |
| `MCP_WRITES_ENABLED` | no (off) | register write tools |
| `MCP_DESTRUCTIVE_ENABLED` | no (off) | register destructive tools |
| `MCP_FRAPPE_TIER_ENABLED` | no (off) | register the Frappe tier |
| `FRAPPE_BASE_URL` | frappe tier (prod) | Frappe base URL (local default `http://127.0.0.1:8001`) |
| `FRAPPE_HOST_HEADER` | no (`lebtech.local` on local) | Host header for named-site routing |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | frappe tier | Frappe token auth pair |

Secrets are env-only (never committed, never logged); every outbound error
message is passed through a redactor that strips known secret values.

## Tool inventory (69 total when everything is enabled)

### Portal tier — read (always on, 16)
`portal_whoami`, `health_check`, `leads_list`, `customers_list`,
`invoices_list`, `invoice_get`, `receipts_list`, `commissions_list`,
`report_run`, `report_pnl`, `call_kpis`, `audit_logs_list`, `countries_list`,
`resellers_list`, `contracts_list`, `delete_queue_list`

### Portal tier — write (`MCP_WRITES_ENABLED`, +19)
`lead_create`, `lead_update`, `lead_import_simulate` (simulate-only route),
`customer_create`, `customer_update`, `invoice_create`, `invoice_update`,
`receipt_create`, `receipt_update`, `commission_entry_update`,
`admin_country_create`, `admin_country_update`, `admin_reseller_create`,
`admin_reseller_update`, `admin_white_label_update`, `admin_user_create`,
`admin_user_update`, `call_dial` (respects app-side `TELEPHONY_LIVE_DIAL`),
`call_disposition`

### Portal tier — destructive (`MCP_DESTRUCTIVE_ENABLED` + `confirm:true`, +4)
`admin_delete_request`, `admin_delete_queue_resolve`,
`admin_delete_queue_clear_all`, `admin_commission_cancel`

### Frappe tier (`MCP_FRAPPE_TIER_ENABLED`)
- **read (+16):** `frappe_ping`, `frappe_list_leads`, `frappe_list_customers`,
  `frappe_list_calls`, `frappe_list_invoices`, `frappe_list_receipts`,
  `frappe_list_commission_entries`, `frappe_list_resellers`,
  `frappe_list_contracts`, `frappe_report`, `frappe_white_label_get`,
  `frappe_integration_settings_list`, `frappe_api_keys_list`,
  `frappe_delete_queue_list`, `frappe_validate_csv`, `frappe_export_records`
- **write (+11):** `frappe_create_lead`, `frappe_update_lead`,
  `frappe_convert_lead`, `frappe_create_customer`, `frappe_update_customer`,
  `frappe_upsert_call`, `frappe_upsert_country`, `frappe_upsert_reseller`,
  `frappe_white_label_save`, `frappe_integration_setting_upsert`,
  `frappe_update_commission_entry_status`
- **destructive (+3):** `frappe_queue_delete`, `frappe_resolve_delete_request`,
  `frappe_two_factor_remove`

## Verification

```bash
node scripts/smoke-stdio.mjs    # registration matrix over real stdio + prod-refusal check
node scripts/live-verify.mjs    # live reads, write flip+revert on a lead, gate refusals
```

`live-verify` expects the portal dev server on :3000 and (optionally)
`FRAPPE_API_KEY`/`FRAPPE_API_SECRET` for the local stack; without an explicit
`PORTAL_SESSION_SECRET` it uses the app's documented dev fallback secret.

## Client config example

```json
{
  "mcpServers": {
    "lebtech": {
      "command": "node",
      "args": ["<repo>/tools/lebtech-mcp/dist/index.js"],
      "env": {
        "MCP_TARGET": "local",
        "PORTAL_SESSION_SECRET": "<same secret the portal runs with>"
      }
    }
  }
}
```
