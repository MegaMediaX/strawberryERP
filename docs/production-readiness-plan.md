# Production Readiness Plan

**Created:** 2026-06-20
**Goal:** Move the LebTech Partner Platform from the current **NO-GO** state to a justified **production GO**, per the decision rule in [production-go-no-go.md](production-go-no-go.md).
**Target host:** `72.62.182.195` (stand up as **staging** first, then promote/cut over to production).
**Ref to deploy:** `master@02127ae`.

## Current state

- The application is validated locally: Docker stack, Gunicorn, MariaDB, Redis, workers, scheduler, migration, persistence, permission matrix, operations, backup, and restore all pass.
- **Blocking gap is operational, not code.** Five P1 blockers remain open and each requires real provider/external evidence that no repository change can substitute for.
- The launch-candidate checklist ([launch-candidate-checklist.md](launch-candidate-checklist.md)) is 0/30 complete.

## Decision rule (what "GO" means)

Production **GO** requires **all** of:
1. Every open P0/P1 blocker closed with **timestamped provider evidence**.
2. Every launch-candidate checklist item complete with proof.
3. No high/critical dependency findings.
4. Written approval from **platform**, **security**, and **business** owners.

---

## Two procurement decisions on the critical path (start immediately)

These have external lead time and gate Phase 1. They are business/security decisions, not engineering:

| Decision | Options | Owner | Needed by |
| --- | --- | --- | --- |
| **Managed secret store** | HashiCorp Vault / AWS Secrets Manager / 1Password / Azure Key Vault | Security + DevOps | Week 1 (2026-06-23) |
| **Uptime + metrics provider** | Datadog / New Relic / Prometheus+PagerDuty / Uptime Robot / Healthchecks.io | DevOps | Week 1 (2026-06-23) |

Also required before Phase 1 server work can begin:
- SSH access (key) for `72.62.182.195`.
- A staging domain/subdomain under DNS control (e.g. `staging.<domain>`).

---

## Phase 1 — Close the 5 P1 blockers on staging (~4 weeks, parallelizable)

### TICKET P1-1 — Production DNS + TLS  ⟶ START FIRST
- **Owner:** Platform/DevOps · **Effort:** 16h · **Depends on:** nothing (gates all external smoke)
- **Steps:**
  1. Register/delegate the domain; point `staging.<domain>` → `72.62.182.195`.
  2. Provision TLS (Let's Encrypt/ACME or cert manager).
  3. Configure HTTP→HTTPS redirect + HSTS in NGINX (`deploy/nginx/production.conf.example`).
- **Acceptance:** external `nslookup` resolves; `curl -i https://staging.<domain>/` returns 200 with `Strict-Transport-Security`; `EDGE_BASE_URL=https://staging.<domain> npm run smoke:edge` passes.
- **Closes checklist:** TLS configured; HTTP→HTTPS+HSTS present.

### TICKET P1-2 — Managed secrets + rotation
- **Owner:** Security/DevOps · **Effort:** 24h · **Depends on:** secret-store decision, P1-1
- **Steps:**
  1. Provision the chosen secret store; create the credential set (Frappe API key/secret, `PORTAL_SESSION_SECRET`, `PORTAL_API_KEY_SECRET`, `API_KEY_HASH_SECRET`, `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `BACKUP_ENCRYPTION_KEY`, integration secrets) per [secret-management.md](secret-management.md).
  2. Inject onto the host (Docker secrets / host env / cloud identity).
  3. Rotate the dedicated Frappe API user; revoke local/staging-only creds.
- **Acceptance:** `PRODUCTION_ENV_FILE=<path> npm run preflight:production` exits 0 (all secret length/placeholder/image-digest checks pass).
- **Closes checklist:** secrets from managed store + preflight passes; staging creds revoked / prod rotated.

### TICKET P1-3 — Encrypted off-host backup + restore drill
- **Owner:** Platform/DevOps · **Effort:** 12h · **Depends on:** P1-2 (encryption key), off-host target provisioning
- **Steps:**
  1. Provision S3 / Cloudflare R2 / SFTP target with versioning + retention (≥7 days; recommend 30/90).
  2. `npm run backup:offhost` → retrieve bundle → decrypt → verify checksum + plaintext manifest (`npm run` `verify-backup`).
  3. Full restore drill into a disposable target, `bench migrate`, smoke.
- **Acceptance:** encrypted upload + post-upload checksum verify pass; restore drill passes; retention policy active.
- **Closes checklist:** backup creation, restore drill, off-host upload/verify, retention.

### TICKET P1-4 — External monitoring + alert delivery
- **Owner:** Platform/DevOps · **Effort:** 16h · **Depends on:** monitoring-provider decision, P1-1
- **Steps:**
  1. Stand up uptime + host/container metrics; probe `/api/health/live` and `/api/health/ready`.
  2. Alert rules: readiness failure, backup failure, TLS expiry (<14d), disk >80%.
  3. Trigger a real readiness failure and confirm the alert reaches on-call; record on-call + escalation **outside the repo**.
- **Acceptance:** monitors active; test alert delivered; backup-failure + readiness-failure alerts proven.
- **Closes checklist:** uptime monitors, host/container metrics, alert delivery tested.

### TICKET P1-5 — Production ingress / WAF activation
- **Owner:** Security/DevOps · **Effort:** 8h · **Depends on:** P1-1 (and P1-4 for log feed)
- **Steps:**
  1. Enable WAF (Cloudflare / AWS WAF / ModSecurity) with OWASP baseline + rate limiting.
  2. Confirm `/erpnext-api/*` and ERPNext Desk paths blocked externally.
  3. Capture a blocked-path event; review false positives.
- **Acceptance:** malicious/blocked path returns 403; blocked-path events captured and reviewed.
- **Closes checklist:** WAF rules active + blocked-path events verified.

---

## Phase 2 — Validate against staging (~1 week)

- **Owner:** QA + Platform · **Effort:** 40h · **Depends on:** all of Phase 1
- Drive the full [launch-candidate-checklist.md](launch-candidate-checklist.md) to green **with timestamped proof**.
- Run the smoke suite against the live staging domain:
  ```bash
  npm run smoke:frappe
  npm run smoke:frappe:permissions
  npm run smoke:frappe:operations
  EDGE_BASE_URL=https://staging.<domain> npm run smoke:edge
  ```
- **Exit bar:** all smoke green; 0 high/critical security findings; checklist 100% with evidence; on-call/escalation recorded.

## Phase 3 — Promote to production (~3 days)

- **Owner:** Security + Business · **Effort:** 20h · **Depends on:** Phase 2 complete
1. Obtain written sign-off from platform, security, and business owners.
2. Rotate to **production-only** secrets in the managed store; revoke staging creds.
3. Deploy + run production smoke + edge against the production domain.
4. Mark the checklist complete with signatures + timestamps → flips the documented decision to **GO**.

---

## Effort + timeline summary

| Item | Phase | Owner | Effort | Target window |
| --- | --- | --- | --- | --- |
| P1-1 DNS/TLS | 1 | DevOps | 16h | Wk 1 (by ~2026-06-27) |
| P1-2 Secrets | 1 | Security/DevOps | 24h | Wk 1–2 (by ~2026-07-04) |
| P1-3 Off-host backup | 1 | DevOps | 12h | Wk 2 (by ~2026-07-04) |
| P1-4 Monitoring | 1 | DevOps | 16h | Wk 2 (by ~2026-07-04) |
| P1-5 WAF | 1 | Security/DevOps | 8h | Wk 2 (by ~2026-07-04) |
| Staging validation | 2 | QA/DevOps | 40h | Wk 3 (by ~2026-07-11) |
| Production promotion | 3 | Security/Biz | 20h | Wk 4 (by ~2026-07-18) |
| **Total** | | | **~136h** | **~4–5 weeks** |

Critical path = the two procurement decisions (secret store, monitoring provider). If those slip, the whole timeline slips.

---

## Runbook: `assigned_user` Link→Data migration (lead/customer assignment fix)

Ships the DocType change from
`docs/superpowers/specs/2026-07-07-partner-user-provisioning-design.md`:
`Partner Lead.assigned_user` and `Partner Customer.assigned_user` change from
`Link → User` to `Data`, because platform users are portal identities, not
Frappe `User` records. Fixes lead-assignment `LinkValidationError` and the
silently-empty Sales-user Frappe lead list.

**⚠️ Human runs every command below, staging first. Nothing here is
auto-executed. This is a SHARED production box — other tenants + a live
ERPNext run on it.**

### 1. Apply on staging first

```bash
# On the staging site only — apply the shipped DocType JSON changes.
bench --site <STAGING_SITE> migrate
```

`Link → Data` is a metadata-only change: both are backed by the same MariaDB
`varchar` column, so no values are transformed and nothing is destroyed.
Existing rows (e.g. leads assigned to `Administrator`) keep their value and
remain valid.

### 2. Smoke-check on staging (proves the fix)

```bash
# Should now succeed where it previously raised LinkValidationError.
bench --site <STAGING_SITE> execute lebtech_partner_platform.api.leads.create_lead \
  --kwargs "{'company_name':'QA Assign Test','country':'Lebanon','assigned_user':'Rami K.','contact_first_name':'QA','contact_last_name':'Test','gender':'Male','phone':'0000000','email':'qa.assign@example.com','status':'New Lead (Uncontacted)'}"
```

### 3. Read-only report of Administrator-assigned rows (business review)

```bash
# Read-only. Lists rows still assigned to Administrator so a human can decide
# whether to reassign them to a real portal user via the admin UI. Writes nothing.
bench --site <SITE> execute frappe.client.get_list \
  --kwargs "{'doctype':'Partner Lead','filters':{'assigned_user':'Administrator'},'fields':['name','company_name','assigned_user'],'limit_page_length':0}"
bench --site <SITE> execute frappe.client.get_list \
  --kwargs "{'doctype':'Partner Customer','filters':{'assigned_user':'Administrator'},'fields':['name','company_name','assigned_user'],'limit_page_length':0}"
```

Reassignment (if desired) uses the existing admin path — no new tooling.

### 4. Promote to production

After staging validation, run step 1's `bench migrate` against the production
site (human-gated, per the promotion policy above).

### 5. Rollback

```bash
# Revert both DocType JSON files (fieldtype back to "Link", options "User"), redeploy, then:
bench --site <SITE> migrate
```

**Caveat:** rollback re-imposes the `Link → User` constraint. It is only safe
**before** any new lead/customer is saved with a non-Frappe-User `assigned_user`
(e.g. `"Rami K."`) in that environment — otherwise `bench migrate` will fail
validating the existing Data value against the restored Link. Roll back
promptly or not at all.

_Regression guards for this change: `frappe_app/.../api/test_assigned_user_fieldtype.py`
(DocType stays `Data`) and `src/lib/security/__tests__/assigned-user-name-contract.test.ts`
(GET-scope + write agree on the display-name string)._
