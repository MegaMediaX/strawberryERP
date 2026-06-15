# Regional Director UI/UX — Deep Specification

The Regional Director is responsible for one or more assigned countries. Their UI is a **regional performance command center**. They do not manage the whole platform like Super Admin and do not work lead-by-lead like Sales Users — they monitor and manage country-level performance across resellers.

## 1. Core UX Principle
On login they immediately know: how their country is performing; which resellers are doing well / falling behind; where leads are stuck; where revenue is stuck; which follow-ups are overdue; which contracts/invoices need attention. Prioritize **visibility, comparison, escalation, regional control**.

## 2. Access Scope
Regional Directors can only see data for their assigned country/countries.
**Can see:** assigned countries; resellers operating in those countries; leads/customers/invoices/receipts in those countries; country-level reports; reseller performance inside assigned countries; team activity inside; calendar activity inside.
**Cannot see:** other countries; global settings; API Developer Center; Super Admin settings; global WhatsApp credentials; global Google API credentials; white-label master settings; full platform P&L outside their countries.

## 3. Main Routes
/regional/dashboard, /regional/countries, /regional/resellers, /regional/resellers/:id, /regional/leads, /regional/leads/:id, /regional/customers, /regional/customers/:id, /regional/invoices, /regional/receipts, /regional/commissions, /regional/calendar, /regional/reports, /regional/search, /regional/profile. Optional: /regional/escalations, /regional/contracts, /regional/activity.

## 4. Sidebar
Desktop: Dashboard, Countries, Resellers, Leads, Customers, Invoices, Receipts, Commissions, Calendar, Reports, Search, Profile. If the director has only one country, the Countries section can show as a country profile page instead of a list.
Mobile bottom nav: Home, Resellers, Leads, Reports, More. Inside More: Customers, Invoices, Receipts, Commissions, Calendar, Search, Profile.

## 5. Dashboard (/regional/dashboard)
Answers: what is happening in my region today; which reseller needs attention; which country metric is weak; where is conversion blocked; where is money delayed.
Desktop top bar: Country Selector, Global Search, Date Range Filter, Notifications, Profile. Main grid: Regional Performance Summary, Reseller Leaderboard, Follow-Up Risk Center, Pipeline Overview, Revenue & Receipts, Contract Bottlenecks, Commission Overview, Team Activity Snapshot, Recent Escalations / Activity.
Mobile header: Country Selector, Search, Notifications. Cards: Regional Summary, Reseller Ranking, Overdue Follow-Ups, Interested Leads, Pending Invoices, Unsigned Contracts, Revenue This Month, Recent Activity.

## 6. Country Selector
If multi-country: "All My Countries" + each assigned country. Default = All My Countries. Every widget updates on selection. Director never sees countries outside permission. Filter is **sticky across pages**. Mobile = top dropdown / chip row.

## 7. Dashboard Widget Priority
1 Regional Performance Summary, 2 Reseller Leaderboard, 3 Overdue Follow-Ups, 4 Interested Leads, 5 Pending Invoices, 6 Unsigned Contracts, 7 Revenue This Month, 8 Conversion Rate, 9 Commission Overview, 10 Recent Activity.

## 8. Regional Performance Summary Widget
KPI cards (Leads, Interested, Customers, Pending Invoices, Revenue This Month, Conversion Rate, Overdue Follow-Ups), each clickable to a filtered list. Date range filter: Today / This Week / This Month / Quarter / Custom.

## 9. Reseller Leaderboard Widget
Reseller comparison table (Rank, Reseller, Leads, Interested, Customers, Revenue, Overdue). Rows clickable to reseller regional profile. Quick filters: Highest revenue, Most overdue, Best conversion, Most leads, Least activity. Insight, not punishment.

## 10. Follow-Up Risk Center
Overdue follow-ups, VIP leads overdue, interested leads overdue, resellers with overdue follow-ups. [View Overdue Leads] → /regional/leads?followup=overdue. Filter by reseller/user/priority.

## 11. Pipeline Overview
Stages: New Lead, Attempted Contact, Awaiting Response, Interested, Scheduled Follow-Up, Converted, Contract Signed, Deposit Paid, Fully Paid. Desktop horizontal with counts + percentages; mobile vertical. Clicking a stage opens filtered records. Country/reseller/date filters. Show bottlenecks.

## 12. Regional Reseller List (/regional/resellers)
Columns: Reseller, Countries, Active Leads, Interested Leads, Customers, Revenue, Pending Invoices, Overdue Follow-Ups, Commission, Status, Actions. Mobile card. Filters: Country, Status, Revenue range, Overdue, Commission status, Activity level, Date range. Show country-specific metrics for the selected country.

## 13. Reseller Regional Profile (/regional/resellers/:id)
Sections: Reseller Summary, Country Breakdown, Lead Pipeline, Team Activity, Customers, Invoices, Receipts, Commissions, Recent Activity. Mostly read/monitor/escalate; view-only labels. Quick buttons: View Leads, View Customers, View Invoices, Export Report.

## 14. Regional Leads (/regional/leads)
Columns: Company, Contact, Gender, Country, Reseller, Assigned User, Status, Priority, Source, Follow-Up, Last Activity, Actions. Actions: Open, View Timeline, WhatsApp (if allowed), Escalate, Export; Reassign/Transfer only if permission. Mobile card. Filters: Country, Reseller, Assigned user, Status, Priority, Source, Follow-up date, Overdue, No activity, Date range, Tags, Custom fields. Saved views: Overdue Follow-Ups, Interested Leads, VIP Leads, No Activity, Newly Added, Converted This Month. Always show reseller + country.

## 15. Regional Lead Detail (/regional/leads/:id)
Header: Company, Reseller, Country, Status, Priority. Main: Contact Details, Assignment Info, Important Details, Notes, Timeline, Attachments, Related Customer/Invoice. Monitoring-focused, prominent timeline, clear ownership, read-only labels if cannot edit.

## 16. Escalation Flow (/regional/escalations)
Cases: VIP lead overdue, Interested ignored, Invoice overdue, Contract stuck, Reseller inactive, WhatsApp failures. Flow: Escalate → reason → note → notify Reseller Admin/Super Admin → timeline entry. Escalation button only in key risk views. Logged. Notify via WhatsApp/in-app/email per Super Admin rules. Lets the director act without taking ownership.

## 17. Regional Customers (/regional/customers)
Columns: Company, Contact, Country, Reseller, Customer Status, Contract Status, Invoice Status, Balance, Assigned User, Last Activity, Actions. Mobile card. Filters: Country, Reseller, Customer status, Contract status, Payment status, Balance due, Fully paid, Recently converted, Date range. Focus stuck customers.

## 18. Regional Customer Detail (/regional/customers/:id)
Sections: Customer Summary, Reseller Ownership, Contact Details, Contract Status, Invoices, Receipts, Notes, Timeline, Attachments. Read-only by default. Progress bar: Contract Not Signed / Contract Signed / Deposit Paid / Fully Paid. Contract file link if allowed.

## 19. Regional Invoices (/regional/invoices)
Columns: Invoice #, Customer, Country, Reseller, Amount, Currency, Status, Due Date, Created By, Payment Progress, Actions. Actions: Open, Download PDF, View Customer, View Receipt, Escalate. Filters: Country, Reseller, Status, Currency, Due date, Overdue, Amount range, Date range, Created by. Business labels: Paid / Partially Paid / Unpaid / Overdue.

## 20. Regional Receipts (/regional/receipts)
Columns: Receipt #, Customer, Country, Reseller, Invoice #, Amount, Currency, Payment Method, Date, Created By, Actions. Filters: Country, Reseller, Payment method, Currency, Date range, Created by. Payment method icon/badge. Export if allowed.

## 21. Regional Commissions (/regional/commissions)
Cards: Pending, Approved, Paid, Commission This Month, Top Commission Reseller. Table: Date, Reseller, Country, Invoice, Customer, Trigger, Invoice Amount, Commission %, Commission Amount, Status. Can see % if allowed; cannot modify rules. Filter reseller/country/date/status.

## 22. Regional Calendar (/regional/calendar)
Views: Today, Week, Month, Agenda. Events: Lead follow-ups, Customer meetings, Contract reminders, Invoice due dates, Payment reminders, Escalations. Filters: Country, Reseller, Salesperson, Event type, Priority. Default mobile = agenda. Clicking opens the record. Overdue obvious. Visibility calendar.

## 23. Regional Reports (/regional/reports)
Categories: Country Performance, Reseller Performance, Lead Conversion, Follow-Up Activity, Revenue & Receipts, Pending Invoices, Contract Bottlenecks, Commission Reports, Lead Sources, Team Activity. Filters: Country, Reseller, Date Range, Status, Source, Priority, Currency, Payment Status. Export CSV/Excel if allowed. Visual first; compare resellers; trends over time.

## 24. Regional Search (/regional/search)
Across: Leads, Customers, Invoices, Receipts, Resellers, Contracts. Result cards show country + reseller. Permission-filtered. Mobile full-screen. Recent searches.

## 25. Notifications
Events: VIP lead overdue, Interested ignored, Reseller many overdue, Invoice overdue, Contract unsigned too long, Commission generated, WhatsApp failure, Lead transferred between resellers, Customer fully paid, Escalation response. Grouped by reseller/country. Click opens filtered list/record. Urgency labels. Digest if allowed.

## 26. Profile (/regional/profile)
Sections: Account, Assigned Countries, Appearance, Calendar Visibility, Notifications, Security. Show assigned countries, light/dark, timezone, read-only role permissions, future 2FA.

## 27. Empty States
No Assigned Countries (contact Super Admin); No Resellers in Country; No Overdue Follow-Ups (region on track); No Pending Invoices (up to date).

## 28. Error States
Country Access Denied (switch to assigned); Reseller Out of Scope; Record Access Denied; Export Not Allowed.

## 29. Microinteractions
Country selector sticky; widgets animate on filter change; overdue urgent badge; reseller rows trend indicators; export loading state; escalation toast confirmation; timeline entries appear instantly after escalation; filters persist during session; charts update without full reload; clicking a KPI opens the exact filtered list.

## 30. Permission-Based UI
Hide export if not allowed; hide commission section if not allowed; read-only if view-only; country selector if multi-country, badge if single.

## 31. vs Other Roles
Sales = call/whatsapp/follow-up/convert. Reseller Admin = assign/monitor team/invoice/receipt/coach. Regional Director = compare resellers/monitor country/spot bottlenecks/escalate/analyze regional reports/track revenue + follow-up discipline. Super Admin = global control/settings/permissions/integrations/API/white-label/accounting.

## 32. Recommended Components
CountrySelector, RegionalSummaryCard, ResellerLeaderboard, ResellerMetricCard, PipelineStageCard, FollowUpRiskCard, RevenueTrendChart, ContractBottleneckCard, CommissionOverviewCard, RegionalLeadTable, RegionalCustomerTable, EscalationModal, Timeline, FilterDrawer, ExportButton, PermissionLockedState.

## 33. Final Codex Instruction
Build the Regional Director interface as a country-level command center. The Regional Director must be able to: monitor assigned countries only; compare resellers inside assigned countries; view regional leads/customers/invoices/receipts/commissions; identify overdue follow-ups and bottlenecks; view pipeline + conversion performance; filter by country/reseller/user/status/date/source/priority/currency; access regional reports; view team activity across resellers; escalate issues to Reseller Admin or Super Admin. The UI must be permission-filtered at every level. The country selector must control the entire interface. Every record must clearly show country and reseller ownership. Focus on visibility, comparison, risk detection, escalation. Do not expose ERPNext UI. Do not show global Super Admin settings. Do not allow access outside assigned countries.
