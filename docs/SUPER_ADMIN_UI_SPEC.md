# Super Admin UI/UX — Deep Specification

The Super Admin is the master controller of the whole platform. Their UI should feel like a SaaS control center, not a normal CRM dashboard. They control the full system: Tenants / resellers, Countries, Roles, Permissions, Branding, Accounting rules, Commissions, API keys, Integrations, WhatsApp, Google Calendar, Google Drive, Delete queue, Audit logs, White-label settings. The Super Admin must be powerful, but the UI should still be clean and organized.

## 1. Super Admin Core UX Principle
Main Goal — when the Super Admin logs in, they should immediately know: How is the whole platform performing? Which countries are active? Which resellers are performing? Where are bottlenecks? Which invoices/payments are pending? Which integrations need attention? Are there delete requests or API issues? The Super Admin UI should focus on: Global control, System health, Business performance, Configuration, Risk visibility, White-label management.

## 2. Super Admin Access Scope
Full access to: All countries, resellers, users, leads, customers, invoices, receipts, commissions, settings, integrations, API keys, audit logs, delete requests. Super Admin can also: Impersonate users, Override permissions, Permanently delete records, Clear delete queue, Control white-label features, Control frontend settings.

## 3. Super Admin Main Routes
/admin/dashboard, /admin/countries, /admin/countries/new, /admin/countries/:id, /admin/resellers, /admin/resellers/new, /admin/resellers/:id, /admin/users, /admin/users/new, /admin/users/:id, /admin/leads, /admin/leads/:id, /admin/customers, /admin/customers/:id, /admin/invoices, /admin/invoices/:id, /admin/receipts, /admin/receipts/:id, /admin/commissions, /admin/reports, /admin/calendar, /admin/search, /admin/accounting, /admin/accounting/invoicing, /admin/accounting/currencies, /admin/accounting/payment-methods, /admin/accounting/expenses, /admin/integrations, /admin/integrations/whatsapp, /admin/integrations/google-calendar, /admin/integrations/google-drive, /admin/integrations/smtp, /admin/api, /admin/api/keys, /admin/api/documentation, /admin/api/logs, /admin/branding, /admin/white-label, /admin/custom-fields, /admin/notifications, /admin/delete-queue, /admin/audit-logs, /admin/settings, /admin/profile.

## 4. Super Admin Sidebar
Desktop Sidebar: Dashboard; Operations [Leads, Customers, Invoices, Receipts, Calendar]; Partners [Countries, Resellers, Users, Commissions]; Accounting [Invoicing, Currencies, Payment Methods, Expenses, P&L]; Platform [White Label, Branding, Custom Fields, Notifications, API Developer Center, Integrations, Delete Queue, Audit Logs, Settings].
Mobile Bottom Navigation: Home, Operations, Partners, Reports, More. Inside More: Accounting, Integrations, API, Settings, Audit Logs, Delete Queue, Profile.
UX Notes: grouped sidebar sections; not one huge flat menu; badges for urgent sections (Delete Queue, Failed API calls, Failed WhatsApp messages, Overdue invoices, Integration errors); sidebar collapsible.

## 5. Super Admin Dashboard (/admin/dashboard)
Answers: What is happening across the whole SaaS platform? What needs my attention? Which country/reseller is best/worst? Where are financial or operational risks?
Desktop top bar: Global Search, Date Range Filter, Country Filter, Reseller Filter, Quick Add Button, Notifications, Profile.
Main grid: Global Performance Summary, Country Performance Map/List, Reseller Leaderboard, Revenue & P&L Summary, Follow-Up Risk Center, Pending Invoices, Contract Bottlenecks, Commission Overview, Integration Health, API Activity, Delete Queue Alerts, Recent Audit Activity.
Mobile cards: Global Summary, Revenue This Month, Overdue Follow-Ups, Pending Invoices, Top Countries, Top Resellers, Integration Alerts, Delete Queue, Recent Activity.

## 6. Dashboard Widgets — Priority Order
1 Global Performance Summary; 2 Today Needs Attention; 3 Revenue & P&L; 4 Country Performance; 5 Reseller Leaderboard; 6 Follow-Up Risk Center; 7 Pending Invoices; 8 Contract Bottlenecks; 9 Commission Overview; 10 Integration Health; 11 Delete Queue; 12 Audit Activity.

## 7. Global Performance Summary Widget
Example: Total Leads, Interested Leads, Customers, Active Resellers, Countries, Revenue This Month, Pending Invoices, Overdue Follow-Ups. Every metric clickable → filtered list. Clean cards, not dense tables. Date range filter.

## 8. Today Needs Attention Widget
Top dashboard card. Example: N invoices overdue, N follow-ups overdue, N contracts not signed, N delete requests waiting, N WhatsApp failures, N API keys with failed requests. Buttons: Review Invoices, Review Delete Queue, Check Integrations. Action-first; items link to filtered pages; show risk priority; urgent badges but not overdone.

## 9. Country Management (/admin/countries)
List columns: Country, Currency, Timezone, Active Resellers, Leads, Customers, Revenue, Invoice Prefix, Status, Actions. Actions: Open, Edit, Deactivate, View Resellers, View Reports. Default countries: Lebanon, Cyprus, Jordan, Syria. Israel must be blocked — clear block message. Add/Edit flow (tabbed): General → Currency → Timezone → Invoicing → Branding → Save. Fields: Country name, Currency, Timezone, Invoice prefix, Active/inactive, Default payment methods, Branding config, Tax fields (later). Show invoice preview if branding/prefix changes.

## 10. Reseller Management (/admin/resellers)
List columns: Reseller, Countries, Admin, Active Users, Leads, Customers, Revenue, Commission Rule, Branding Mode, Status, Actions. Actions: Open, Edit, Login As, View Leads, View Reports, Deactivate. Country badges; multi-country shown; Login As visible only to Super Admin + creates audit log.
Add Reseller WIZARD (8 steps): 1 Basic Info (name, legal name, email, phone, status, notes); 2 Countries (multi-select, badges, per-country settings); 3 Admin User (first/last/email/phone/password/role); 4 Visibility Rules (per reseller/country toggles: customers across countries? users see only assigned leads? reseller admin see all leads? leads transfer to/from? invoices created? contracts uploaded? Google Drive contracts?); 5 Branding (global/country/reseller/allow-reseller-customize; logo, primary/secondary color, invoice logo, portal logo, footer; live preview dashboard/invoice/portal); 6 Commission (percentage, trigger [Invoice Created/Deposit Paid/Fully Paid], currency, applies-to countries, active; example calc); 7 Payment/Currency (allowed currencies, default, allowed payment methods, country overrides); 8 Review → Create.

## 11. User Management (/admin/users)
List columns: Name, Email, Role, Country, Reseller, Status, Last Active, 2FA Status, Actions. Actions: Open, Edit, Login As, Deactivate, Reset Password. Admin manually creates users (no invitation flow). Add User flow: Basic Info → Role → Scope → Password → Save. Fields: first/last/email/phone/role/assigned countries/assigned reseller/password/timezone/active. Role-aware: Regional Director requires country; Reseller Admin requires reseller; Sales Team User requires reseller + assigned countries. Hide irrelevant fields by role.

## 12. Login As / Impersonation
Flow: User List → Login As → Confirm reason → Start → Banner shows active impersonation → Exit. Require confirmation; optional reason; audit log required; persistent warning banner ("You are currently viewing as X. Exit impersonation"); easy return to own account.

## 13. Lead Management (/admin/leads)
Monitor all leads globally. Columns: Company, Contact, Gender, Country, Reseller, Assigned User, Status, Priority, Source, Follow-Up, Last Activity, Actions. Actions: Open, Reassign, Transfer, Convert, Archive/Delete. Filters: country/reseller/assigned user/status/priority/source/tags/follow-up date/overdue/no activity/date range/custom fields. Default views: All Active, Overdue Follow-Ups, Interested, VIP, Unassigned, No Activity, Recently Imported. Show ownership on every row.

## 14. Lead Detail (/admin/leads/:id)
Header: Company, Country, Reseller, Assigned User, Status, Priority. Main: Contact Details, Important Details, Status/Follow-Up, Notes, Attachments, Timeline, Related Customer/Invoice. Right panel: Ownership, Transfer, Reassign, Convert, Audit Trail, Admin Actions. Super Admin sees everything; clear ownership; audit trail/link; can permanently delete.

## 15. Customer Management (/admin/customers)
Columns: Company, Contact, Country, Reseller, Customer Status, Contract Status, Invoice Status, Balance, Assigned User, Last Activity, Actions. Filters: country/reseller/customer status/contract status/payment status/balance due/fully paid/date range/custom fields. Focus bottlenecks (contract not signed, deposit unpaid, unpaid balance). Allow export.

## 16. Customer Detail (/admin/customers/:id)
Sections: Customer Summary, Contacts, Ownership, Contract, Invoices, Receipts, Notes, Timeline, Attachments, Audit Trail. Top actions: WhatsApp, Create Invoice, Upload Contract, Create Receipt, Transfer, Delete, Add Note. Progress bar: Contract Not Signed → Contract Signed → Deposit Paid → Fully Paid. Show linked lead history + Google Drive contract links.

## 17. Accounting Center (/admin/accounting)
Central place for invoices, receipts, expenses, currencies, payment methods, P&L, invoice numbering. Inner sidebar: Overview, Invoicing, Receipts, Payment Methods, Currencies, Expenses, P&L.

## 18. Invoicing Settings (/admin/accounting/invoicing)
Settings: invoice numbering type, global invoice prefix, country invoice prefixes, PDF template, QR code toggle, payment link toggle, WhatsApp share toggle, email send toggle, footer text, tax fields (later). Numbering: Global (INV-0001) or Country-Based (LB-INV-0001, CY-INV-0001). Live invoice preview; changing numbering shows warning.

## 19. Payment Methods (/admin/accounting/payment-methods)
Default: Cash, Bank Transfer, OMT, Whish, Credit/Debit Card, Crypto. Fields: name, enabled, assigned countries, assigned resellers, requires reference, requires attachment, display order, icon. Database-driven; cards/icons; disable not delete; availability reflects on receipt forms.

## 20. Currency Settings (/admin/accounting/currencies)
Initial: USD, LBP, EUR, JOD, SYP. Fields: code, symbol, decimal precision, enabled, default, countries, resellers, manual exchange rate (optional). Not hardcoded; add/disable; warning if disabling a used currency.

## 21. Expenses / P&L (/admin/accounting/expenses, /admin/accounting/pnl)
Expense fields: category, amount, currency, country (opt), reseller (opt), date, notes, attachment. P&L dashboard: revenue, receipts, expenses, gross profit, commissions, net profit. Only Super Admin sees full P&L; Regional Directors see country-limited if allowed; Sales never see expenses.

## 22. Commission Management (/admin/commissions)
Cards: Pending, Approved, Paid, Commission This Month, Top Commission Reseller. Table: Date, Reseller, Country, Invoice, Customer, Trigger, Invoice Amount, Commission %, Commission Amount, Status, Actions. Actions: Open, Approve, Mark Paid, Recalculate, Export. Super Admin manages rules; entries auto-created; show calculation; log all changes.

## 23. API Developer Center (/admin/api)
Sections: Overview, Setup API Key, Documentation, API Logs, Rate Limits. Setup flow: name → select permissions → set expiry/IP/rate limit → generate → copy. Key fields: name, description, read access, write access, allowed modules, expiration, IP whitelist, rate limit. Allowed: Read, Create, Update. Blocked: Delete. Key shown only once; store hashed; revoke/regenerate; show last used; plain-language scopes; NO delete scopes. Documentation (Swagger/OpenAPI style): base URL, auth, endpoints, params, example requests/responses, error codes, scopes; copy buttons; state "Delete operations are not available through the API." API Logs columns: API Key, Endpoint, Method, IP, User Agent, Status Code, Duration, Timestamp; filters key/endpoint/method/status/date range/IP.

## 24. Integrations Center (/admin/integrations)
Sections: WhatsApp, Google Calendar, Google Drive, SMTP Email, Integration Logs.

## 25. WhatsApp Integration (/admin/integrations/whatsapp)
Providers: Meta WhatsApp Cloud API, WasenderAPI.com. One global WhatsApp system. Meta fields: App ID, App Secret, Phone Number ID, WhatsApp Business Account ID, Permanent Access Token, Webhook Verify Token, Webhook URL, Message templates. WasenderAPI fields: API key, Sender number/instance ID, Webhook URL, Connection status, Test message button. Provider selector; hide irrelevant fields; Test Connection button; status (Connected/Error/Not configured); recent errors.

## 26. Google Calendar Integration (/admin/integrations/google-calendar)
Fields: Google Client ID, Client Secret, Redirect URI, Calendar API enabled, Default Calendar ID, Sync mode, Reminder time, Connection status, Test connection. Super Admin sets credentials; users connect their own from profile; setup checklist; callback URL copy button.

## 27. Google Drive Integration (/admin/integrations/google-drive)
Contracts stored in Google Drive. Fields: Client ID, Client Secret, Root folder ID, Contract folder structure, Connection status, Test upload button. Show folder path/ID; test upload creates+removes a test file; show sync errors; contracts link back to customers.

## 28. SMTP Email (/admin/integrations/smtp)
Fields: SMTP host, port, username, password, from email, from name, encryption type, Test email button. Hide password by default; test email required; show status; used for reminders/invoices/receipts/notifications.

## 29. Notification Rules (/admin/notifications)
Channels: WhatsApp, Email, In-app, Calendar. Events: Follow-up due, Invoice created, Receipt issued, Contract pending, Payment overdue, Lead assigned, Lead transferred, Commission generated, API error, WhatsApp failure, Delete request submitted. Event-based table; per-row channel toggles; per-role/per-reseller overrides later; avoid spam; quiet hours if possible.

## 30. White-Label Management (/admin/white-label)
Control the product as a sellable SaaS. Sections: Platform Identity, Tenant Branding Rules, Module Availability, Portal Settings, Future Billing Controls. Fields: Platform name, Global logo, Favicon, Default colors, Login page branding, Public portal branding, Allow reseller branding, Allow country branding, Custom domain readiness, Enabled modules per tenant/reseller. Live preview (login page, dashboard, invoice, reseller portal). Super Admin only.

## 31. Custom Fields Builder (/admin/custom-fields)
Flow: Select Module → Add Field → Choose Type → Configure Visibility → Save. Modules: Leads, Customers, Invoices, Receipts, Resellers. Types: Text, Number, Date, Dropdown, Checkbox, File, Currency, Phone, Email. Fields appear automatically in forms; searchable/filterable if enabled; don't break core required fields; show preview.

## 32. Delete Queue (/admin/delete-queue)
Admins delete → items go here; Super Admin decides permanent deletion. Columns: Item Type, Item Name, Deleted By, Role, Country, Reseller, Deleted At, Reason, Actions. Actions: Restore, Permanently Delete, Clear All. Clear All requires confirmation; high-risk warning; log all permanent deletes; filter by item type/reseller/country/date.

## 33. Audit Logs (/admin/audit-logs)
Columns: Timestamp, User, Role, Action, Module, Record, Country, Reseller, IP Address, Details. Tracked: login, logout, login as user, lead/customer/invoice/receipt/commission/settings changes, API usage, delete requests, permanent deletes, integration changes. Searchable, filterable, exportable, read-only, trustworthy.

## 34. Reports (/admin/reports)
Categories: Global Performance, Country Performance, Reseller Performance, Lead Conversion, Follow-Up Activity, Revenue & Receipts, P&L, Commission Reports, Lead Sources, API Usage, Integration Health, Team Activity. Filters: country/reseller/user/date range/source/priority/status/currency/payment status. Visual first, table second; export CSV/Excel; save report views.

## 35. Calendar (/admin/calendar)
Global visibility of scheduled platform activity. Views: Today, Week, Month, Agenda. Events: Lead follow-up, Customer meeting, Contract reminder, Invoice due, Payment reminder, Escalation, Internal task. Filters: country/reseller/user/event type/priority. Clicking event opens related record; show Google Calendar sync state.

## 36. Global Search (/admin/search)
Across: Leads, Customers, Invoices, Receipts, Resellers, Countries, Users, Contracts, API keys, Audit logs (if allowed). Fast; group results by module; show ownership (country/reseller/assigned user); recent searches.

## 37. Settings (/admin/settings)
Sections: General, Roles & Permissions, Localization, Languages, Timezones, Appearance, Security, System Defaults, Modules, Backup/Export. Cards/tabs (not one massive page); changes audit logged; "danger zone" for some settings.

## 38. Localization / Language (/admin/settings/localization)
Super Admin controls multi-language. Fields: enabled languages, default language, date format, number format, currency display format, RTL support (later if Arabic). Translation-ready architecture.

## 39. Security (/admin/settings/security)
Features: password rules, session timeout, login alerts, 2FA (final phase, authenticator app), allowed IPs (optional), API security settings. Clear; warnings for risky changes; show last security events.

## 40. Super Admin Notifications
Events: delete request submitted, API key generated, API error spike, WhatsApp failed, Google Drive failed, invoice overdue, contract overdue, new reseller created, commission generated, suspicious login, integration disconnected. Group by severity; filter unread/system/business/security/integration; click opens exact issue.

## 41. Empty States
No Resellers ("Create your first reseller…" → Add Reseller). No Countries ("Add a country to begin platform setup."). No API Keys ("Generate an API key…"). No Integration Configured ("WhatsApp is not configured yet. Set up a provider…").

## 42. Error States
Blocked Country ("This country cannot be added to the platform. Please choose another country."). API Delete Blocked ("Delete operations are not allowed through the API. Use the Super Admin dashboard to manage permanent deletion."). Permission Conflict ("This permission conflicts with the selected role…"). Integration Failed ("Connection failed. Please check your credentials and try again."). Invoice Numbering Warning ("Changing invoice numbering may affect future invoice references. Existing invoices will not be changed.").

## 43. Microinteractions
Dashboard cards update after filter change; API key copy shows copied confirmation; integration test shows loading/success/failure; Delete Queue Clear All requires typed confirmation; Login As shows persistent banner; branding preview updates live; country/reseller badges consistent; filter states persist per session; export buttons show progress; invoice preview updates instantly; permission toggles show helper text; audit log entries appear immediately after sensitive actions.

## 44. Permission-Based UI Behavior
Super Admin controls what others see. Pages include controls for: role permissions, reseller-level permissions, country-level visibility, customer visibility rules, API scopes, notification rules, invoice numbering rules, branding permissions, custom fields visibility. Plain-language labels; avoid developer terms; grouped toggles (Leads/Customers/Invoices/Reports/Settings/Integrations/API); show impact preview if possible.

## 45. Super Admin UX vs Other Roles
Sales User: Call/WhatsApp/Follow-up/Update status/Convert. Reseller Admin: Assign/Monitor team/Invoice/Receipt/Coach/Manage reseller ops. Regional Director: Compare resellers/Monitor country/Spot bottlenecks/Escalate/Analyze regional reports. Super Admin: Control platform/Configure system/Manage white-label SaaS/Monitor global performance/Manage integrations/Manage API/Manage accounting rules/Manage risk & security.

## 46. Recommended Components
GlobalSummaryCard, TodayNeedsAttentionCard, CountryPerformanceCard, ResellerLeaderboard, RevenueSummaryCard, PnLSummaryCard, FollowUpRiskCard, PendingInvoiceCard, IntegrationHealthCard, ApiActivityCard, DeleteQueueAlertCard, AuditActivityCard, CountryForm, ResellerWizard, UserRoleSelector, PermissionMatrix, BrandingPreview, InvoicePreview, ApiKeyGenerator, ApiDocsViewer, IntegrationSetupForm, NotificationRuleTable, CustomFieldBuilder, DeleteQueueTable, AuditLogTable, GlobalSearchResult.

## 47. Final Codex Instruction
Build the Super Admin interface as the full SaaS platform control center. The Super Admin must be able to: manage all countries/resellers/users/leads/customers/invoices/receipts/commissions/expenses/reports/integrations/API keys/branding/white-label/custom fields/delete queue/audit logs; configure multi-country reseller rules; assign resellers to multiple countries; control customer visibility per reseller/country; configure commission triggers per reseller; configure payment methods and currencies dynamically; configure global/country/reseller branding; configure invoice numbering globally or per country; configure Meta WhatsApp Cloud API or WasenderAPI as the global WhatsApp provider; configure Google Calendar API credentials; configure Google Drive storage for contracts; configure SMTP email; generate API keys with read/create/update scopes only; block API delete access completely; view API documentation and logs; permanently delete records from the delete queue; impersonate users with audit logging; control notification rules; manage white-label SaaS settings; view global P&L and reports. UI powerful but organized into clear sections. Use grouped navigation, dashboards, filters, live previews, wizards, and audit-safe actions. Do not expose raw ERPNext UI. Keep accounting actions business-friendly. Make all sensitive actions auditable. Make the platform white-label SaaS ready from the beginning.
