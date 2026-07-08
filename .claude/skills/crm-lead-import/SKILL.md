---
name: crm-lead-import
description: Use when importing a CSV (or any batch) of leads into the LebTech Partner Platform CRM, formatting raw lead rows to the platform's lead schema, bulk-assigning leads to a single sales owner (e.g. force every row to Elie Mouawad), or wiring CSV lead data into the dev-store so it renders in the leads view. Covers header mapping, required-field validation, country/phone/email rules, duplicate policy, and the persistence gap between the simulate-only import route and a real leads collection.
---

# CRM Lead Import (LebTech Partner Platform)

## Overview

Turn a raw CSV of leads into validated platform leads, optionally force every
lead onto one assigned owner, and land them in the CRM. **Reuse the existing
pure pipeline in `src/lib/reseller/csv-import.ts` — never hand-roll a parser or
a second lead schema.**

**Model split (fixed for this workflow): Opus plans the import approach; Sonnet
executes the import and writes the leads.** Opus reads the code, confirms the
exact assignee string + the persistence path, and produces the step plan +
row mapping. Sonnet then runs the pipeline, prints the preview, and performs the
writes only after human approval.

## When to Use

- "Add these CSV leads to the CRM and assign them to <person>."
- Formatting external/scraped lead rows to the platform lead schema.
- Bulk-assigning an imported batch to one sales owner (the "force assignee" step).
- Any time raw lead columns must be validated before they touch the leads view.

**Do NOT use for:** single-lead entry (use the New-Lead form /
`POST /api/frappe/leads`), editing existing seed leads (that's `leadOverrides`),
or live Frappe/ERPNext writes (backend is the source of truth when configured).

## Pipeline (reuse — do not reinvent)

`src/lib/reseller/csv-import.ts` exposes the whole flow as pure functions:

```
parseCsv(text) → autoMapColumns(headers) → buildRecord(cells, mapping, defaults)
              → validateRecords(records, ctx) → summarizeImport(records, policy)
```

- `parseCsv` — RFC-4180-ish: quoted fields, embedded commas, doubled quotes, CRLF/LF.
- `autoMapColumns` — best-effort header→field mapping via the synonym table below.
- `buildRecord` — builds a `NewLeadInput`, fills blanks from defaults, normalizes gender.
- `validateRecords` — required fields + email + phone + country + assignee + dedup.
- `summarizeImport` — imported / skipped / duplicates under a duplicate policy.

## Field Schema

Required (8): `companyName, country, assignedUser, contactFirstName,
contactLastName, gender, phone, email`.
Optional: `notes, source, status, followUpDate`.

`assignedUser` is a **Data display-name string**, NOT a User link. Use the exact
`name` from `portalUsers` (e.g. **`Elie Mouawad`** = `USR-SALES-ELIE`), never the
email or user id.

## Header Synonyms (auto-map)

| Field | Accepted headers (normalized) |
|-------|-------------------------------|
| companyName | company, business, organisation, organization, account |
| country | country, nation |
| assignedUser | assigned, assignee, owner, salesperson, rep |
| contactFirstName | first, firstname, fname, givenname |
| contactLastName | last, lastname, lname, surname, familyname |
| gender | gender, sex |
| phone | phone, mobile, tel, telephone, contactnumber, cell |
| email | email, mail, e-mail, emailaddress |
| notes | notes, note, comment, comments, remarks |
| source | source, channel, leadsource, origin |

## Validation Rules

- **Required** — every required field non-empty (after defaults).
- **country** — must be in `allowedCountries` = `Lebanon, Cyprus, Jordan, Syria`.
- **email** — `EMAIL_RE`.
- **phone** — `PHONE_RE = /^\+?[\d][\d\s().-]{6,}$/`. Prefer Lebanese local-dial
  format used elsewhere in the app.
- **gender** — `^m…`→`Male`, `^f…`→`Female`, else blank (→ required-field error).
- **assignedUser** — must be in the acting user's assignable set (`assignableUsersFor`).
- **duplicate** — `dedupKey = norm(company)|digits(phone)`; repeats within the file
  or against existing leads are flagged.

## Force-Assignee Step

To assign the whole batch to one owner, set `defaults.assignedUser = "<name>"`
**and** override any per-row assignee so the file's own column can't win:

```ts
const record = buildRecord(cells, mapping, defaults);
record.assignedUser = "Elie Mouawad"; // force — ignore any CSV assignee column
```

## Defaults

`country = Lebanon`, `source = "CSV Import"`, `status = "New Lead (Uncontacted)"`.

## Duplicate Policy

Default **`skip`** (invalid rows always skipped; valid duplicates skipped).
Other policies: `update`, `import-anyway`, `mark-duplicate`.

## ⚠️ Persistence Gap (read before "importing")

The import boundary `POST /api/frappe/leads/import` is **simulate-only**: it
returns `{ simulated: true, summary }` and persists nothing. `POST
/api/frappe/leads` (dev-store branch) also just echoes. `GET /api/frappe/leads`
reads the **static `leads` array** in `src/lib/sample-data.ts`; the dev-store
holds only `leadOverrides` (edits to seed leads) — there is **no collection new
leads can land in**.

To make imported leads actually render in the CRM (dev-store mode), the minimal
persistence path is:

1. Add a mutable `createdLeads` collection + `appendLead()` to `src/lib/dev-store.ts`.
2. Map `NewLeadInput` → the `leads`-array shape: `contact = "${first} ${last}"`,
   `assignedTo = assignedUser`, `followUp = "Unscheduled"`, a default `priority`,
   and `reseller` derived from the assignee (default `Beirut Digital Partners`).
3. `POST /api/frappe/leads` dev-store branch → `appendLead(mapped)`.
4. `GET /api/frappe/leads` → read `[...leads, ...getCreatedLeads()]` before
   `filterByPermission` + `paginate`.
5. Add a unit test for the forced-assignment + persistence path; keep the diff minimal.

If persistence is out of scope, say so explicitly — the result is a **validated
simulation**, and leads will NOT appear in the leads view.

## Verification Checklist

- [ ] Detected headers + column mapping printed before any write.
- [ ] Preview of first 3 built records shown; `assignedUser` == the forced owner.
- [ ] Imported count == valid non-duplicate rows; rejects written to an error file (`errorLogCsv`).
- [ ] Every imported lead's `assignedUser` equals the owner's exact display string.
- [ ] Leads render in the CRM leads view (drive the UI, not just tests).
- [ ] Existing `csv-import` tests pass; a test covers the forced-assignment path.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using email/user-id as `assignedUser` | Use the `name` string (`Elie Mouawad`) |
| Trusting the file's assignee column | Force `record.assignedUser` after `buildRecord` |
| Calling the import route and reporting "done" | That route only simulates — leads don't persist |
| New parser / second lead schema | Reuse `csv-import.ts`; map into the existing `leads` shape |
| Country outside the allowed 4 | Only `Lebanon, Cyprus, Jordan, Syria` validate |
