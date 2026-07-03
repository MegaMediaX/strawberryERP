# UI/UX Click-Path Audit — LebTech Partner Platform (2026-07-03)

Every interactive touchpoint (button, link handler, form submit, action select) across the four
portals was traced: handler → state writes → API route (existence + method verified) → final
state vs. the label's promise. ~500 touchpoints across ~90 component files. The four
highest-impact findings were then **reproduced live in the browser** (dev-store mode).

**Totals: 45 findings — 8 HIGH · 13 MEDIUM · 24 LOW — plus 20 by-design disabled placeholders
(correct pattern: disabled + tooltip) and 15 items flagged for deeper manual testing.**

Live-confirmed in browser: A-001/A-002, S-001, R-008 (see § Live verification).

Reference implementations already in the codebase for most fixes:
`AdminCommissionsView.act()`, `AdminSlotApprovalsView.act()`, `AdminDeleteQueueView.act()`,
`AdminLeadDetail.call()` — all check `res.ok`, surface `data.error`, only refresh/close on success.

---

## Systemic patterns (fix once, kill many bugs)

1. **Forward-link query params are silently dropped** while sticky filters rehydrate over them
   (A-001, A-002, R-001, R-002, R-003, R-005, R-013). Dashboard KPI tiles and cross-links
   promise a filtered list; the target page ignores `?status=`/`?reseller=`/`?followup=` and
   restores whatever the user filtered last. The `useStickyFilters` contract explicitly supports
   explicit-initial-wins — the regional leads page wires it; admin pages and most others don't.
2. **Silent mutation failures**: `fetch` → `router.refresh()` with no `res.ok` check
   (A-003 cluster, A-004…A-010). A 4xx repaints the old state with zero feedback — the button
   looks broken.
3. **Legacy `Phase2Forms.tsx` lacks error/refresh discipline** (S-007, S-008, S-009, R-007,
   R-008, R-009): no try/finally (stuck "Creating…"), no `router.refresh()` after mutations,
   six enabled buttons with **no onClick at all**.
4. **Dev-store echo-only writes** (S-003…S-006): `/api/frappe/leads` POST/PATCH and
   `/api/frappe/customers` POST return success but persist nothing, while sibling routes
   (disposition, admin leads) do persist. Reassign/notes/new-lead/convert all silently vanish.
5. **Orphaned components** (11 of 16 platform components have no importer:
   PlatformShell, PortalNavigation, MobileNav, LeadsWorkspace, CommissionApprovalConsole,
   FollowUpReminderConsole, PaymentMethodForm, CurrencyForm, InvoiceNumberingForm, ResellerForm,
   5 of 7 Phase2Forms exports). They carry stale `/settings/*` navigation and pre-date current
   conventions — cleanup or deprecation-note pass recommended.

---

## Live verification (browser, dev-store)

| # | Repro | Result |
|---|---|---|
| A-002 | `sessionStorage.clear()` → navigate `/admin/leads?status=Contacted (Interested)` | **CONFIRMED** — Status select empty, all 4 leads listed, stored filters `{}`; param dropped |
| S-001 | `/sales/calling` → select "Contacted (Interested)" in status → click advance ("Finish", same handler as "Save & Next →") | **CONFIRMED** — queue completes; `GET /api/frappe/leads` still shows `Scheduled Follow-Up`; selection silently lost |
| R-008 | `/reseller/invoices/INV-2026-LB-0041` (Paid $2,500 / Rem $5,825) → Create receipt $1,000 | **CONFIRMED** — server persisted (reload: $3,500/$4,825, 2 receipts) but page kept stale balance AND amount field still offered full old remaining → duplicate-payment trap |
| S-002 | Quick outcome "Interested" from `Scheduled Follow-Up` | works from that status — the dead path is specific to `New Lead (Uncontacted)` per the transition matrix (`lead-workflow.ts`), where Interested/Not Interested/Call Later always error |

Note: the live run mutated dev-store state (LEAD-2408 → Contacted (Interested), +$1,000 receipt);
in-memory only — reverts on dev-server restart.

---

## ADMIN portal (17 findings, ~230 touchpoints)

**A-001 [HIGH] — "Resellers"/"Reports"/"Leads" cross-links** — `AdminCountriesView.tsx:65-66`,
`AdminResellersView.tsx:65-66`. Links pass `?country=`/`?reseller=`; no admin page reads
`searchParams` (grep: zero usages under `src/app/admin/`). Sticky filters win. Also
`AdminResellersView` has no country filter, so `?country=` can't work even wired.
Fix: parse `searchParams`, pass as `initial` to `useStickyFilters` consumers.

**A-002 [HIGH] — "Interested" KPI tile** — `AdminDashboardView.tsx:75` →
`/admin/leads?status=Contacted%20(Interested)` ignored. LIVE-CONFIRMED. Same fix as A-001.

**A-003 [MEDIUM] — Silent-failure mutation cluster** (no `res.ok` → refresh regardless → UI
reverts, no error): Deactivate/Activate in `AdminCountriesView.tsx:19-29`,
`AdminResellersView.tsx:21-27`, `AdminUsersView.tsx:34-40`; channel chips + Active toggle in
`AdminNotificationsView.tsx:41-45`; Remove field `AdminCustomFieldsView.tsx:80-86`; Revoke key
`AdminApiKeysView.tsx:68-74`; Convert/Archive/Reassign `AdminLeadsView.tsx:48-63` (dialog closes
even on 4xx). Fix: check `res.ok`, surface `data.error` (see reference implementations).

**A-004 [MEDIUM] — Payment-method dialog "Save"** — `AdminPaymentMethodsView.tsx:26-30`.
Closes dialog unconditionally; failed PATCH = silent loss. Same for row Disable/Enable.

**A-005 [MEDIUM] — Currency Disable/Enable** — `AdminCurrenciesView.tsx:20-25`. Guarded server
rejection (e.g. default currency) invisible.

**A-006 [MEDIUM] — "Test connection"** — `AdminIntegrationForm.tsx:45-55`. Saves first
(result ignored) then tests; failed save → tests the *previous* config → can show
"Connection OK" for settings never saved.

**A-007 [MEDIUM] — Customer "Delete (to queue)"** — `AdminCustomerDetail.tsx:40-45`. Navigates
to list even when the PATCH failed; record not queued, no error.

**A-008 [MEDIUM] — "Add note" (`AdminCustomerDetail.tsx:32-39`) / list "Delete"
(`AdminCustomersView.tsx:41-46`)** — failure silently swallowed.

**A-009 [MEDIUM] — "Permanently delete all"** — `AdminDeleteQueueView.tsx:53-60`. The most
destructive button in the portal closes its confirm dialog and refreshes with no `res.ok`
check; per-row `act()` right above does it correctly.

**A-010 [LOW] — "Save settings"** — `AdminIntegrationForm.tsx:37-43`. `!res.ok` →
indistinguishable from not-clicked.

**A-011 [LOW] — "Add currency"/"Add expense"** — `AdminCurrenciesView.tsx:26-32`,
`AdminExpensesView.tsx:21-27`. No busy flag (double-submit duplicates), no catch (network error
= silent stall).

**A-012 [LOW] — Mobile action buttons miss `disabled={busy}`** — `AdminCustomersView.tsx:95`,
`AdminLeadsView.tsx:135-137`. Desktop rows disable in-flight; mobile duplicates don't.

**A-013 [LOW] — Missing network-error catch** — `RequestDeleteButton.tsx:18-27`,
`AdminUsersView.tsx:42-49` (Reset password: no catch and no finally).

**A-014 [LOW] — Branding "Reset" over-promises** — `AdminBrandingView.tsx:27`. Resets
logo/colors/footer to defaults but keeps currently-edited platformName/tagline — mixed state.

**A-015 [LOW] — Invoicing "Save" stale warning** — `AdminInvoicingForm.tsx:38-46`. After save,
"changing numbering may affect…" warning persists (compares against pre-save prop; no refresh).

**A-016 [LOW] — "Exit impersonation"** — `ExitImpersonationButton.tsx:8-15`. Redirects even
when the DELETE failed → cookie may persist, banner reappears.

**A-017 [LOW] — Notifications inbox filter never restores** — `AdminNotificationsView.tsx:37`.
`useStickyFilters(..., { category: "all" })` — non-empty default defeats hydration; stored value
written but never read. Fix: undefined-as-all, or sentinel-exempt defaults in the hook.

---

## REGIONAL + RESELLER portals (14 findings)

**R-001 [HIGH] — "Pending invoices" KPI** — `RegionalDashboardView.tsx:38` →
`/regional/invoices?status=pending`; page reads only `country`; "pending" isn't even a legal
status value. KPI number and landing list disagree. Fix: map pending → Unpaid|Partially
Paid|Overdue, pass `initialFilters`.

**R-002 [HIGH] — "View customers"** — `RegionalResellerProfile.tsx:39` →
`/regional/customers?reseller=X` ignored; sticky restore can even show a *different* reseller's
filter — actively misattributes data. `RegionalCustomersView` hardcodes `{}` (line 41).

**R-003 [HIGH] — "View invoices"** — `RegionalResellerProfile.tsx:40`, same as R-002.

**R-004 [MEDIUM] — "N stuck before payment"** — `RegionalCustomersView.tsx:61-67`. Count
includes `Contract Not Signed OR Contract Signed` (`customer-list.ts:63`) but the click filters
only `Contract Not Signed` — signed-but-unpaid customers vanish; count ≠ list.

**R-005 [MEDIUM] — "View overdue leads" KPI** — `RegionalDashboardView.tsx:41,55` →
`/regional/leads?followup=overdue` sets the view but `initialFilters` is effectively empty →
sticky filters restore and intersect → count mismatch, possibly empty list while KPI says 7.
Fix: skip hydration when an intent param is present.

**R-006 [MEDIUM] — CSV "Import N leads"** — `ResellerCsvImport.tsx:85-98,203`. `!res.ok` → no
error state, wizard sits on step 3; unexpected body shape throws uncaught; network error
silent. Button "does nothing".

**R-007 [MEDIUM] — "Create invoice"** — `Phase2Forms.tsx:58-77` (live at
`/reseller/invoices/new`). No try/finally → any network hiccup leaves "Creating…" forever; no
redirect/reset on success.

**R-008 [HIGH] — "Create receipt"** — `Phase2Forms.tsx:227-251` (live at
`/reseller/invoices/[id]`). LIVE-CONFIRMED: no `router.refresh()` → Balance/Receipts stay
stale; amount defaults to old remaining → duplicate-payment trap. Also stuck-loading on error.

**R-009 [LOW] — 6 dead buttons** — `Phase2Forms.tsx:186-194, 311-315`. "Generate PDF",
"Generate QR code", "Share by WhatsApp", "Generate receipt PDF", "Send by WhatsApp",
"Send by email": enabled buttons with **no onClick**. Fix: disabled + tooltip per house
convention, or implement.

**R-010 [LOW] — PDF links 404** — `RegionalInvoicesView.tsx:131`,
`ResellerInvoicesView.tsx:82,121`, `ResellerReceiptsView.tsx:64,102` →
`/generated/invoices/*.pdf`; `public/generated/` doesn't exist.

**R-011 [LOW] — "Request archive" is theater** — `ResellerLeadDetail.tsx:35-39,101`. Shows
"submitted — your Super Admin will review" but calls nothing; no queue entry is ever created.

**R-012 [LOW] — "Contracts not signed" always 0** — `ResellerDashboardView.tsx:31,82` via
`dashboard-metrics.ts:82,89` (hard-coded).

**R-013 [LOW] — Reseller dashboard links carry no intent** — 20 links → bare `/reseller/leads`
where saved view + sticky filters apply; "Overdue follow-ups: 4" can land on a list not showing
those 4. Regional does this correctly with `?stage=`/`?followup=`.

**R-014 [LOW] — Notifications bell read-set replace** — `RegionalNotificationsBell.tsx:40-47`.
Overwrites read-ids with only currently-visible ones; country-scoped views resurrect old
notifications as unread. Fix: union.

---

## SALES portal + shared platform (17 findings)

**S-001 [HIGH] — "Save & Next →" doesn't save** — `SalesCallingQueue.tsx:77`. LIVE-CONFIRMED.
Identical handler to "Skip"; keyed `LeadCallScreen` unmounts and discards unsaved status/date/
note. Silent data loss on the primary agent workflow. Fix: await the screen's save before
advancing, or rename to "Next".

**S-002 [HIGH] — Quick outcomes dead for uncontacted leads** — `LeadCallScreen.tsx:357-366`.
From `New Lead (Uncontacted)` the matrix (`lead-workflow.ts`) allows only Attempted/Awaiting;
"Interested"/"Not Interested"/"Call Later" always error — on the primary cold-call case. The
buttons are enabled regardless. Fix: extend matrix (product call) or disable invalid outcomes
for the current status.

**S-003 [MEDIUM] — "Create customer" doesn't convert** — `LeadCallScreen.tsx:589`. Customers
POST echoes without persisting; no lead-status change; no refresh. Badge disappears on
navigation; lead convertible repeatedly; customer never appears in lists.

**S-004 [MEDIUM] — "Reassign" doesn't persist** — `LeadCallScreen.tsx:685`. Leads PATCH
dev-branch is echo-only (`accepted by frontend boundary`, no `applyLeadOverride`); refresh
re-reads old assignee; local state masks it until reload. Admin path persists the same op —
fix the dev branch to match.

**S-005 [MEDIUM] — "Save note" evaporates** — `LeadCallScreen.tsx:455`. Same echo-only PATCH;
note exists only client-side; gone on reload; server-rendered timeline/follow-ups never see it.
Payload is the full recomputed notes blob → clobber risk once Frappe is live.

**S-006 [MEDIUM] — "Add lead" doesn't persist** — `NewLeadForm.tsx:167` (sales + reseller new-
lead pages). POST echo-only; success banner then redirect to a list that can't contain it.

**S-007 [MEDIUM] — "Test connection" saves instead** — `Phase2Forms.tsx:455`
(IntegrationSettingsForm, orphaned). Both buttons `type="submit"` on the same form; test = save
with `connectionStatus: "Needs test"`.

**S-008 [MEDIUM] — Invoice/receipt builders stuck-loading** — `Phase2Forms.tsx:160,288` (= R-007/
R-008's loading half). No try/catch/finally anywhere in the two live builders.

**S-009 [LOW] — 6 dead buttons** — same as R-009 (`Phase2Forms.tsx:186-194,312-314`).

**S-010 [LOW] — "Wrong Number" records nothing** — `LeadCallScreen.tsx:216`. Success-styled
message tells the agent to "update the contact details"; no flag saved, no edit surface exists.

**S-011 [LOW] — Stale followUpDate leaks across outcomes** — `LeadCallScreen.tsx:93,229`.
Pick a date for "Call Later", then tap "Interested" → unintended follow-up date written onto a
non-scheduled status. Fix: clear date when target status isn't Scheduled.

**S-012 [LOW] — Orphaned forms navigate to removed routes** — `PaymentMethodForm.tsx:68/148`,
`CurrencyForm.tsx:57/149`, `ResellerForm.tsx:67/160` → `/settings/*` now catch-all-redirects to
persona home; a successful save dumps the user on the dashboard. (Trap if revived.)

**S-013 [LOW] — ReportsView race** — `ReportsView.tsx:52-54`. Effect refires per keystroke, no
abort/sequence token → older slow response can overwrite newer results; error branch reads only
the revenue body. (Used by admin/regional/reseller report pages. `CallCenterView` has the abort
pattern to copy.)

**S-014 [LOW] — NewLeadForm "Reset" drops the pre-filled assignee** — `NewLeadForm.tsx:69-70,170`.
Reset → submit errors "Missing required field(s): assignedUser".

**S-015 [LOW] — ImpersonationConsole "Start impersonation" (orphaned)** — `Phase2Forms.tsx:545`.
Returns JSON, sets no cookie; effective user never changes (real one lives at
`/api/admin/impersonate`).

**S-016 [LOW] — Scheduled lead can't be rescheduled** — `LeadCallScreen.tsx:87,411`. Date field
only renders when *entering* Scheduled; Save disabled when `!dirty` → no path to change an
existing follow-up date from the call screen.

**S-017 [LOW] — ApiKeyManager "Generate key" (orphaned)** — `Phase2Forms.tsx:393`. No busy
state (double-POST), no catch.

---

## Needs deeper manual testing (not statically provable)

- `lebtech.floorplan.filters` sessionStorage shared between admin and reseller personas
  (impersonation inherits filters → map can look empty).
- Stale sticky filters vs. fresh data: a since-deactivated reseller filter restores silently →
  fully-filtered-out empty lists.
- Slot layout editor HTML5 drag-and-drop across browsers (occupied-cell rejection, no dupes).
- Integration form masked-secret round-trip (mask may overwrite the real secret on save).
- Reseller customer pages import static seeds while invoice pages use the dev store →
  cross-page balance inconsistency after payments.
- InvoiceBuilder default `dueDate="2026-06-30"` is already past → instantly Overdue invoices.
- Search inputs: `onBlur` recents-commit racing result-link taps (iOS Safari).
- `SalesNotificationsBell` backdrop z-40 = bottom-nav z-40 (tap-through risk).
- Login button re-enables before navigation completes (double-submit window).
- `tel:`/`wa.me` links mark "Call started" even when the OS has no handler.
- `window.confirm` paths no-op silently in embedded/iframe contexts.
- CountrySelector restore effect vs. back/forward history (soft loop risk).

---

## By-design disabled placeholders (correct, counted, not bugs)

20 total, all with explanatory tooltips: reseller team Edit ×2 / Deactivate / locked Add-member,
Transfer ×2, Export report, Create invoice/receipt (role-locked), Branding/Payment
methods/Currencies locked rows, LoginAs (no admin user), slot-editor mobile notice, sales
profile "Connect Google Calendar (coming soon)", PortalNavigation impersonation spans ×5
(orphaned).
