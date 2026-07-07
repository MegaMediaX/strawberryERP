# Partner-user provisioning / `assigned_user` link-validation fix — design + plan

Date: 2026-07-07
Status: proposed, awaiting human approval before dispatch
Author: PM/tech-lead planning pass (no application code touched by this doc)

## 1. Corrections to the problem statement (verified against the repo)

Before designing, I read every file the brief cited. Two factual corrections:

- **Seed names.** `src/lib/portal-security.ts:45-80` seeds exactly 4 `portalUsers`:
  `Super Admin` (USR-SUPER), `Maya Regional` (USR-REG-LB), `Beirut Reseller Admin`
  (USR-RESELLER-BDP), `Rami K.` (USR-SALES-RAMI, Sales Team User). The names
  "Georges Khoueiry", "Marven El Mouallem", "Elie Mouawad" do not appear anywhere
  in the repo (`grep` returned zero hits) — the brief's roster was aspirational/
  illustrative, not the actual seed. The design below is name-agnostic (works for
  whatever the seed array contains), so this doesn't change the fix, but the
  migration section below is written against the real seed.
- **The Add-Lead dropdown already submits the display name correctly.**
  `NewLeadForm.tsx:131-133` renders `<option key={a.name}>{a.name}</option>` with
  no `value` attribute — per the HTML spec, an `<option>` with no `value` attribute
  uses its text content as the value. So `form.assignedUser` is already the plain
  display name (e.g. `"Rami K."`), not blank/`undefined`. This *is* what the app
  wants (see §3). No frontend change is needed here — I flag this because the
  brief's open-question #3 assumed this needed fixing; it doesn't.

Everything else in the brief's problem statement checked out exactly as described,
plus one thing the brief missed (found while reading `leads-scope.ts` and
`leads.py`) that materially strengthens the case for the chosen design — see §2.4.

## 2. The core decision

### 2.1 Rejected: Option A (new `Partner User` DocType)

A mirror DocType would need: a new doctype, a provisioning script, an ongoing
sync obligation (every dev-store user CRUD path must also write Frappe), and a
migration to re-point `assigned_user`'s `options` to it. Nothing downstream
needs *referential integrity* on this field — see §2.4, every consumer of
`assigned_user` today (dropdown, `assignable-users.ts`, `leads-scope.ts`,
telephony) treats it as an opaque display-name string compared by `===`. A Link
buys FK integrity + Frappe-side search/reporting on Users; we have neither a
user nor a requirement for either right now. This is the YAGNI case: don't build
a synced identity table to satisfy a constraint (`Link → User`) that is itself
the bug.

### 2.2 Rejected: Option B (real Frappe `User` records)

Adds real login-capable accounts to a **shared production box** running other
tenants' data (marven, strawberry, an existing v16 ERPNext) — a licensing and
security-surface change the task explicitly flags as needing to be weighed, and
which the deployment policy (human-gated, staging-first) makes expensive to
even trial. It also does nothing for telephony by itself — it would need an
email → display-name bridge added on top, since `CallRecord.agent`/`assignedTo`
are plain display-name strings (§3), not emails. Rejected: real cost (accounts
on a shared prod box) for no benefit this task actually needs.

### 2.3 Chosen: Option C — downgrade `assigned_user` from `Link → User` to `Data`

This is not a new idea for this codebase — it is the exact fix already applied
to the *same class of bug* here: `Portal Two Factor.user` was changed to
`{"fieldtype": "Data", "label": "Portal User Id", ...}` (see
`frappe_app/.../doctype/portal_two_factor/portal_two_factor.json:11`) specifically
because "portal IDs aren't Frappe users" (`BUILD_STATE.md:749`). `assigned_user`
is the identical situation: a portal identity used only as a plain scoping label,
force-fit into a `Link → User`, and it breaks the instant the label isn't a real
Frappe User docname.

**The change:** in
`frappe_app/.../doctype/partner_lead/partner_lead.json` and
`frappe_app/.../doctype/partner_customer/partner_customer.json`, change
`assigned_user` from
`{"fieldtype": "Link", "options": "User", "reqd": 1, ...}` to
`{"fieldtype": "Data", "label": "Assigned User", "reqd": 1, "search_index": 1}`
(Partner Customer's `assigned_user` isn't `reqd`, keep it optional). Both fields
are backed by the same underlying `varchar` column in MariaDB — Frappe's
migration handles a Link→Data fieldtype change as a metadata-only DDL/schema
update; no existing values need transforming, and nothing is destroyed.

**Why this satisfies both hard constraints:**
- **Autodialer stays working** — trivially, because the Data field now stores
  exactly the display name telephony already expects. See §3 for the full proof.
- **Shared prod box** — zero new accounts, zero new DocTypes, zero provisioning
  script run against production. The only prod-facing change is a
  `bench migrate` after the DocType JSON ships (human-gated, staging-first, per
  §5).

### 2.4 Bonus finding: this also fixes a second, previously-unnoticed live bug

`src/lib/security/leads-scope.ts:20` already sends
`scope.assigned_user = user.name` (the display name) as the Frappe `list_leads`
filter for a Sales Team User. Today, with `assigned_user` as `Link → User`,
that filter can only ever match a lead whose `assigned_user` is a real Frappe
User docname — which, per the brief, is only ever `Administrator`. So **every
Sales Team User's Frappe-backed lead list is silently empty today** (filter
`assigned_user = "Rami K."` matches nothing). Once `assigned_user` is a Data
field storing the display name, this filter starts working correctly with zero
code changes. I call this out explicitly so the QA gate (§6, task 6) verifies it
as a real regression-fix, not scope creep.

## 3. Telephony safety — proof the autodialer keeps working

Telephony attribution never touches Frappe or `assigned_user` link semantics —
it is 100% derived from plain strings already flowing through the app:

- `src/lib/telephony/call-record.ts`: `LinkableEntity.assignedTo` (the field
  telephony reads to build `CallRecord.assignedTo`/`.agent`, see
  `buildCallRecord` line ~285) is populated by whatever string sits in the
  lead's `assignedTo`/`assigned_user` field in the app layer — today that's the
  dev-store `LeadOverride.assignedTo` or the sample-data `assignedTo` string
  (`src/lib/sample-data.ts`, e.g. `"Rami K."`, `"Elie"`). Under the Frappe-backed
  path, once `assigned_user` is a Data field, `Partner Lead.assigned_user` holds
  that same display-name string, so `linkCall()` (`call-record.ts:218-247`)
  keeps copying a human-readable name into `CallRecord.assignedTo`/`agent`
  exactly as it does today.
- `src/lib/telephony/call-kpis.ts`: `agentOf()` (line 65) groups by
  `record.agent ?? record.assignedTo ?? "Unassigned"` — a plain string key.
  Nothing here or in `agentCallKpis`/`teamCallKpis` ever resolves an id or a
  Link; it is pure string grouping. Since the upstream string is unchanged (see
  above), per-agent KPI grouping is unaffected.
- `src/lib/telephony/dial.ts`: click-to-call's `DialCommand.requestedBy` is
  supplied directly by the caller (the acting session's name) at enqueue time
  in `dev-store.ts:enqueueDial` — it never reads `assigned_user` from Frappe at
  all, so it is entirely out of scope for this change.

**Net effect: this design changes zero bytes of telephony code**, and the one
Frappe field telephony's linking logic depends on (`assigned_user` as a source
of `assignedTo`) keeps holding the exact same kind of value (a human display
name) it holds today — the fix only makes that value acceptable to Frappe
instead of rejected by `LinkValidationError`.

## 4. Answers to the brief's open questions

1. **Chosen approach + why:** §2.3 (Option C, `Link → User` to `Data`),
   rejecting A (unneeded sync/DocType overhead) and B (real accounts on a
   shared prod box, doesn't fix telephony by itself).
2. **How the lead keeps a display NAME for telephony:** it already does and
   continues to — see §3. No new field, no ingest-time resolution; the existing
   `assigned_user`/`assignedTo` string *is* the name, once Frappe's Link
   constraint stops rejecting it.
3. **Add-Lead dropdown / assignable-users layer:** already correct — see §1.
   `NewLeadForm.tsx` submits the name (no `value` attr → text content is the
   value); `assignable-users.ts` (`assignableUsersFor`, `canAssignLeadTo`) and
   `leads-scope.ts` already key everything by `PortalUser.name`. No changes
   needed to any of these three files.
4. **Provisioning:** **none required.** Because `assigned_user` becomes a plain
   Data label instead of a Link, nothing in Frappe needs to resolve or validate
   it against a roster — validation already happens app-side via
   `canAssignLeadTo` before the proxied write. This is the direct payoff of
   rejecting Option A/B: no provisioning script, no patch, no seed.py addition
   is needed for this fix. (This is distinct from the larger, already-tracked
   "portal-identity ↔ Frappe-user mapping" initiative referenced repeatedly in
   `BUILD_STATE.md` — e.g. line 752, 757, 763 — which is about real per-user
   Frappe logins for desk-level permissions; explicitly deferred, see item 6.)
5. **Migration of the 2 existing `Administrator`-assigned leads:** the
   fieldtype change is non-destructive (Link and Data are both backed by the
   same `varchar` column; `bench migrate` updates only DocType metadata, no
   value transform, no data loss). `"Administrator"` remains a syntactically
   valid Data value post-migration, so nothing breaks or errors. Whether those
   2 leads should be *re-assigned* to a real portal user is a business decision,
   not a technical migration — the existing admin reassignment path
   (`src/app/api/admin/leads/route.ts`, `src/lib/business/lead-reassignment.ts`,
   `AdminLeadsView.tsx`) already supports doing this by hand post-deploy, so no
   new UI/route is needed. Task 5 below adds one small, human-run, idempotent
   `bench execute` reporting command (lists any `Partner Lead`/`Partner
   Customer` still assigned to `Administrator` after go-live) so a human can
   decide whether to reassign — it changes nothing on its own.
6. **Portal Role Assignment / impersonation:** explicitly **deferred, out of
   scope.** Both `Portal Role Assignment.user` and
   `frappe_app/.../api/security.py:85` (`frappe.db.exists("User", target_user)`
   in `start_impersonation`) remain `Link → User`. This is safe to defer because:
   - Impersonation today is fully resolved client-side in
     `portal-security.ts` (`buildSession`/`resolveExplicitPortalSession`)
     against the `portalUsers` array and a signed cookie/header — it never
     calls Frappe's `start_impersonation` method for its actual authorization
     decision (I traced `session/impersonation` in `backend-client.ts:87-89`
     and `Phase2Forms.tsx:559` — it's invoked, but only as an audit-log side
     write; the impersonation UI's authority check is the existing Next-side
     `roleRank`/`canImpersonate` logic, which doesn't touch this method's
     result).
   - `has_partner_lead_permission` in `leads.py:235-253` (a Frappe
     `has_permission` hook comparing `doc.assigned_user == frappe.session.user`)
     already silently assumes real per-user Frappe logins that don't exist
     today. I confirmed the app never exercises this path in practice: all
     traffic from Next.js authenticates to Frappe with **one shared service
     API key** (`src/lib/frappe-client.ts:10,35`, `token {key}:{secret}`), so
     `frappe.session.user` is always the service account (Administrator, which
     satisfies `"Super Admin" in frappe.get_roles(user)` unconditionally) for
     every request the app makes — the Sales/Regional/Reseller branches of that
     hook are dead code on the app's actual traffic path today. This is a
     pre-existing gap, not something this fix introduces or worsens; leave it
     for the tracked §17 portal-identity-mapping initiative.
7. **Test strategy:**
   - **Frontend (vitest):** no existing test needs to change — I checked
     `assignable-users.test.ts`, `leads-scope.test.ts`, and
     `leads-map.test.ts`; all operate purely on the app-layer string contract,
     which is untouched. New coverage: none strictly required on the TS side
     since no TS file changes, but task 4 adds one regression test asserting
     `leadsScopeForFrappe` + `mapLeadToFrappe` together produce a name-keyed
     `assigned_user` value consistent with what Frappe will now accept
     (documents the fix so a future regression is caught even though no
     production code changed).
   - **Frappe (python, host-runnable, no bench needed — see `test_leads.py`'s
     `_install_fakes()` pattern):** add/extend a host-runnable test asserting
     `create_lead`'s validation no longer requires `assigned_user` to resolve
     as a `User` Link (this needs a real bench site to prove end-to-end, since
     Link-validation is enforced by the Frappe framework, not app code — the
     host-runnable test can only assert the DocType JSON's `assigned_user.
     fieldtype == "Data"`; the true regression proof is the human-run bench
     smoke in task 5's acceptance check).
8. **Rollback plan:** revert the two DocType JSON files (`fieldtype` back to
   `"Link"`, `options` back to `"User"`) and re-run `bench migrate`. Because no
   data was transformed (same underlying column), this is symmetric and lossless
   in both directions — the only risk is that a value written while the field
   was `Data` (e.g. `"Rami K."`) would violate the Link constraint again on
   rollback, exactly reproducing today's bug. Rollback is therefore only safe to
   do *before* any new leads are created against the Data-typed field in that
   environment; document this in the runbook (task 5).

## 5. Numbered implementation plan

1. Change `Partner Lead.assigned_user` fieldtype `Link→Data` in
   `frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/partner_lead/partner_lead.json`.
2. Change `Partner Customer.assigned_user` fieldtype `Link→Data` in
   `frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/partner_customer/partner_customer.json`.
3. Add a host-runnable Python regression test asserting both DocType JSON files
   declare `assigned_user` as `Data` (guards against a future well-meaning
   contributor "fixing" it back to `Link → User`).
4. Add one small TS regression test tying `leadsScopeForFrappe` +
   `mapLeadToFrappe` together, documenting that both now agree on a plain
   display-name string for `assigned_user`.
5. Write the human-run runbook addition: (a) the exact `bench migrate` command,
   staging-first; (b) an idempotent `bench execute` one-liner reporting any
   `Partner Lead`/`Partner Customer` rows still assigned to `Administrator`
   (read-only, for the human to decide on reassignment); (c) the rollback
   command + its caveat from §4.8. No script in this task touches production.
6. QA gate: typecheck, full vitest run, telephony/KPI tests, and an explicit
   confirmation pass that the name-attribution path (§3) is intact.

## 6. Task decomposition for fixer agents

| # | Task | Owns (exact files) | Depends on | Parallel? |
|---|------|---------------------|------------|-----------|
| 1 | Partner Lead fieldtype fix | `frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/partner_lead/partner_lead.json` | none | yes |
| 2 | Partner Customer fieldtype fix | `frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/partner_customer/partner_customer.json` | none | yes |
| 3 | Frappe-side regression test | new file `frappe_app/lebtech_partner_platform/lebtech_partner_platform/api/test_assigned_user_fieldtype.py` (host-runnable, follow `test_leads.py`'s `_install_fakes()`-free JSON-load pattern — this test only needs `json.load`, no frappe stub) | 1, 2 (reads their output) | no — sequential after 1 & 2 |
| 4 | TS regression test | new file `src/lib/security/__tests__/assigned-user-name-contract.test.ts` (imports `leadsScopeForFrappe` and `mapLeadToFrappe`; does NOT edit either source file) | none | yes (independent of 1–3; no shared files) |
| 5 | Runbook + rollback doc | `docs/production-readiness-plan.md` (append a subsection) — human-gated commands only, no execution | 1, 2 (must describe the actual final JSON) | no — after 1, 2 |
| 6 | **QA GATE** | none (read-only) | 1, 2, 3, 4, 5 | no — last, sequential |

Task ownership has no file overlap, so 1, 2, and 4 can run fully in parallel;
3 and 5 must wait for 1+2 to land (they describe/verify the exact JSON); 6 is
the final gate.

**Task 1 — Partner Lead fieldtype fix**
- File: `partner_lead.json` only.
- Change: the `assigned_user` field object from
  `{"fieldname": "assigned_user", "fieldtype": "Link", "label": "Assigned User", "options": "User", "reqd": 1, "search_index": 1}`
  to
  `{"fieldname": "assigned_user", "fieldtype": "Data", "label": "Assigned User", "reqd": 1, "search_index": 1}`
  (drop `options`, keep `reqd`/`search_index`).
- Acceptance: `json.load` still parses; the field object has
  `fieldtype == "Data"` and no `options` key; no other field in the file is
  touched (diff should be a 1-line change).

**Task 2 — Partner Customer fieldtype fix**
- File: `partner_customer.json` only.
- Change: `assigned_user` from `{"fieldtype": "Link", "options": "User", ...}`
  (currently not `reqd`) to `{"fieldtype": "Data", ...}`, dropping `options`,
  preserving its current optionality (do not add `reqd`).
- Acceptance: same shape as task 1.

**Task 3 — Frappe-side regression test**
- New file only; do not touch `partner_lead.json`/`partner_customer.json`.
- Loads both JSON files (plain `json.load`, no frappe import needed — mirrors
  how simple this check is, doesn't need `test_leads.py`'s fake-module
  machinery) and asserts `assigned_user.fieldtype == "Data"` and
  `"options" not in assigned_user` for both.
- Acceptance: `python test_assigned_user_fieldtype.py` exits 0 against the
  task-1/2 output; fails loudly (non-zero) if either file still says `Link`.

**Task 4 — TS regression test**
- New test file only; imports from `@/lib/security/leads-scope` and
  `@/app/api/frappe/leads/route` — does not modify either.
- Asserts: `leadsScopeForFrappe({ effectiveUser: { role: "Sales Team User",
  name: "Rami K.", ... } })` yields `{ assigned_user: "Rami K." }`, and
  `mapLeadToFrappe({ assignedUser: "Rami K." })` yields
  `{ assigned_user: "Rami K." }` — i.e., the GET-scope filter and the
  POST/PATCH write agree on the same plain-string contract Frappe will now
  accept.
- Acceptance: `npx vitest run src/lib/security/__tests__/assigned-user-name-contract.test.ts` passes; run full `npm test` to confirm zero pre-existing tests changed behavior.

**Task 5 — Runbook + rollback doc**
- File: `docs/production-readiness-plan.md` only (append, don't restructure
  existing sections).
- Content: (a) staging-first `bench --site <site> migrate` command explicitly
  labeled "human runs this, staging first"; (b) read-only `bench --site <site>
  execute` one-liner querying `Partner Lead`/`Partner Customer` rows where
  `assigned_user = "Administrator"`, for human review — no write; (c) rollback
  command (JSON fieldtype revert + `bench migrate`) with the caveat from
  design §4.8 (safe only before new Data-typed values are written).
- Acceptance: doc renders as valid markdown; commands are copy-pasteable;
  every command is explicitly annotated as human-run / staging-first (no
  script here executes anything).

**Task 6 — QA GATE (final, sequential)**
- No files owned; read-only verification.
- Run: `npm run typecheck`, `npm test` (full vitest suite — confirm the total
  test count only grew by task 3/4's additions, nothing broke), and
  specifically re-run `src/lib/telephony/__tests__/*` (call-kpis, call-record,
  dial) plus `src/lib/security/__tests__/assignable-users.test.ts`,
  `leads-scope.test.ts`, `src/app/api/frappe/leads/__tests__/leads-map.test.ts`
  to confirm the telephony/attribution path and lead-assignment scoping are
  untouched and green.
- Explicitly confirm (read the diff of tasks 1–5): zero changes under
  `src/lib/telephony/`, `src/components/platform/NewLeadForm.tsx`,
  `src/lib/security/assignable-users.ts`, `src/lib/security/leads-scope.ts` —
  proving the autodialer name-attribution path was not touched, only read from
  in a new test.
- Acceptance: all green; a one-paragraph confirmation that the
  name-attribution chain (lead `assigned_user` → `assignedTo` →
  `CallRecord.agent` → `agentCallKpis`) is unchanged end-to-end.
- Explicitly OUT of scope for this gate (and this whole fix): running `bench
  migrate` against any real site, staging or production — that remains
  human-gated per task 5's runbook.
