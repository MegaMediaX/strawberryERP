# Reseller Admin UI/UX — Deep Specification

The Reseller Admin is the operational manager of one reseller organization. Their UI should feel like a team control center, not a global admin panel.
They need to manage:
Their sales team
Their reseller's leads
Customer progress
Invoices and receipts
Follow-ups
Team performance
Important Details shown to sales users
Reseller-level settings allowed by Super Admin
They should not feel overwhelmed by global platform settings.

## 1. Reseller Admin Core UX Principle

Main Goal
When a Reseller Admin logs in, they should immediately know:
What is my team doing?
Which leads need action?
Which customers are stuck?
Which invoices are pending?
Which commissions are generated?
Who needs follow-up today?
The interface should help them manage people, pipeline, and revenue actions.

## 2. Reseller Admin Main Routes

Recommended route structure:
/reseller/dashboard
/reseller/leads
/reseller/leads/new
/reseller/leads/import
/reseller/leads/:id
/reseller/customers
/reseller/customers/:id
/reseller/invoices
/reseller/invoices/new
/reseller/invoices/:id
/reseller/receipts
/reseller/commissions
/reseller/team
/reseller/calendar
/reseller/reports
/reseller/settings
/reseller/search
/reseller/profile
Optional:
/reseller/calling-monitor
/reseller/follow-ups
/reseller/contracts
/reseller/files

## 3. Reseller Admin Sidebar

Desktop Sidebar
Dashboard
Leads
Customers
Invoices
Receipts
Commissions
Team
Calendar
Reports
Settings

Mobile Bottom Navigation
For reseller admin:
Home
Leads
Customers
Invoices
More
Inside More:
Team
Calendar
Reports
Commissions
Settings
Profile

UX Notes
Keep the main navigation simple.
Do not put everything in the first-level mobile nav.
Use badges for urgent items:
overdue follow-ups
pending invoices
unsigned contracts
delete requests
Hide anything Super Admin has disabled.

## 4. Reseller Admin Dashboard

Route
/reseller/dashboard

Dashboard Purpose
The dashboard should answer:
What needs my attention today?
How is my team performing?
Where is money stuck?
Which leads are close to conversion?

Dashboard Layout — Desktop
Top Bar
├── Global Search
├── Quick Add Lead
├── Import CSV
├── Notifications
└── Profile
Main Grid
├── Today Action Center
├── Pipeline Overview
├── Team Performance
├── Follow-Up Queue
├── Customer Status Overview
├── Pending Invoices
├── Commission Summary
└── Recent Activity

Dashboard Layout — Mobile
Header
├── Reseller Name
├── Search
└── Notifications
Cards
├── Today Needs Action
├── Follow-Ups Overdue
├── Interested Leads
├── Pending Invoices
├── Team Activity
├── Customers Pending Contract
└── Commission Summary

## 5. Dashboard Widgets

Recommended Priority Order
| Priority | Widget | Purpose |
| --- | --- | --- |
| 1 | Today Action Center | Shows urgent work |
| 2 | Overdue Follow-Ups | Missed sales actions |
| 3 | Team Follow-Ups Today | Team workload |
| 4 | Interested Leads | Conversion opportunities |
| 5 | New Leads Unassigned | Assignment action |
| 6 | Contracts Not Signed | Customer bottleneck |
| 7 | Pending Invoices | Payment bottleneck |
| 8 | Commission Summary | Reseller financial motivation |
| 9 | Team Performance | Salesperson accountability |
| 10 | Recent Activity | Operational tracking |

Today Action Center
This should be the top widget.
Example:
Today Needs Action
12 follow-ups due today
4 overdue follow-ups
7 interested leads
3 invoices pending
2 contracts not signed
5 unassigned leads
[Open Follow-Ups] [Assign Leads] [View Invoices]

UX Notes
This card should be action-focused.
Each number should be clickable.
Do not make them search manually.
Use clear urgency indicators.

## 6. Reseller Pipeline Overview

Purpose
Show where leads/customers are in the process.
Pipeline stages:
New Lead
Attempted Contact
Awaiting Response
Interested
Scheduled Follow-Up
Converted to Customer
Contract Signed
Deposit Paid
Fully Paid

UI Format
Desktop:
Horizontal pipeline board
Clickable stage cards
Mobile:
Vertical stacked pipeline cards
Example:
New Leads: 34
Interested: 12
Scheduled Follow-Up: 18
Converted: 6
Fully Paid: 2

UX Notes
Clicking a stage opens filtered list.
Do not make pipeline too visually complex.
Use counts and conversion percentages.

## 7. Team Performance Widget

Purpose
Reseller Admin needs to manage salespeople.

Widget Shows
| Salesperson | Leads | Follow-Ups Due | Interested | Converted | Last Activity |
| --- | --- | --- | --- | --- | --- |
| John | 24 | 5 | 7 | 2 | 10 min ago |
| Sarah | 18 | 2 | 5 | 1 | 1 hr ago |

UX Notes
Show workload balance.
Make salesperson row clickable.
Clicking opens filtered view for that user.
Avoid making it feel punitive.
Focus on action and productivity.

## 8. Lead Management for Reseller Admin

Route
/reseller/leads

Purpose
The Reseller Admin sees all leads under their reseller, across allowed countries.

Lead List Desktop UI
Use table view.
Columns:
Company
Contact
Gender
Phone
Country
Assigned User
Status
Priority
Source
Follow-Up
Last Activity
Actions
Actions:
Open
Call
WhatsApp
Reassign
Transfer
Convert

Lead List Mobile UI
Use cards.
Card example:
ABC Logistics
Sarah Haddad · Female
Lebanon · VIP
Interested
Follow-up today 3:00 PM
Assigned to John
[Call] [WhatsApp] [Open]
Swipe or menu actions:
Reassign
Transfer
Convert
Archive

Lead Filters
Reseller Admin filters:
Country
Assigned user
Status
Priority
Source
Tags
Follow-up date
Overdue
Unassigned
Recently updated
No activity
Custom fields

UX Notes
Default saved views:
All Active Leads
Unassigned Leads
Follow-Ups Today
Overdue Follow-Ups
Interested Leads
No Activity
VIP Leads
Filters should be easy to reset.
Add saved filters later.

## 9. Add Lead Flow for Reseller Admin

Route
/reseller/leads/new

Flow
Add Lead
→ Company Info
→ Contact Info
→ Assignment
→ Extra Details
→ Save

Required Fields
Company Name
Country
Assigned User
Contact First Name
Contact Last Name
Gender
Phone
Email

Optional Fields
Notes
Source
Priority
Tags
Attachments
Custom fields

UX Notes
Assigned User should be required, but can default to "Unassigned" only if Super Admin allows.
Country dropdown should only show reseller's assigned countries.
Assigned User dropdown should only show reseller team.
Use collapsible advanced fields.
On mobile, use step-by-step form.

## 10. CSV Import Flow for Reseller Admin

Route
/reseller/leads/import

Flow
Upload CSV
→ Map Columns
→ Validate
→ Preview
→ Assign Defaults
→ Import
→ Result Summary

CSV Fields
Company Name
Country
Assigned User
Contact First Name
Contact Last Name
Gender
Phone
Email
Notes
Source

Import UX Details
Step 1 — Upload
Show accepted format and sample download.
Buttons:
Upload CSV
Download Template
Step 2 — Column Mapping
Allow mapping:
CSV Column → System Field
Example:
Company → Company Name
First → Contact First Name
Mobile → Phone
Step 3 — Validation
Show:
missing required fields
invalid emails
invalid phone formats
unknown countries
unknown assigned users
duplicate warnings
Step 4 — Assign Defaults
If CSV has missing optional values, allow defaults:
Default Country
Default Assigned User
Default Source
Default Priority
Step 5 — Import Result
Show:
132 leads imported
8 skipped
12 duplicates detected
Download error file

UX Notes
Never import blindly.
Always preview errors.
Make duplicate warnings clear.
Allow admin to choose:
skip duplicate
update existing
import anyway
mark as possible duplicate

## 11. Lead Assignment / Reassignment Flow

Route
From lead list or lead detail:
Assign / Reassign
→ Select salesperson
→ Optional note
→ Save

UI Details
When selecting salesperson, show:
John
24 active leads
5 follow-ups today
Last active 10 min ago

UX Notes
Help admin balance workload.
Log reassignment in timeline.
Notify new assigned user by WhatsApp/in-app if enabled.
If auto-assignment is enabled, show label:
"Assigned by round-robin"
"Assigned by country rule"
"Assigned manually"

## 12. Lead Transfer Between Resellers

Flow
Lead Detail
→ Transfer Lead
→ Select target reseller
→ Select target country
→ Select target user if allowed
→ Add transfer note
→ Confirm

UX Notes
Transfer should require confirmation.
Timeline must show:
old reseller
new reseller
user who transferred
timestamp
note
Only allowed if Super Admin permissions allow it.
If target reseller has different branding/country rules, apply correct settings after transfer.

## 13. Reseller Admin Lead Detail Screen

Route
/reseller/leads/:id

Layout Desktop
Header
├── Company Name
├── Status Badge
├── Priority Badge
├── Assigned User
└── Quick Actions
Main Left
├── Contact Details
├── Important Details
├── Status / Follow-Up
├── Notes
├── Attachments
└── Timeline
Right Panel
├── Assignment
├── Customer Conversion
├── Related Invoices
├── Related Receipts
└── Admin Actions

Mobile Layout
Company Header
Contact Actions
Important Details
Status & Follow-Up
Notes
Timeline
More Actions

Required Visible Info
Company name
Contact first name
Contact last name
Gender
Phone
Email
Country
Assigned user
Status
Priority
Source
Follow-up date
Notes
Important Details
Timeline

Admin Actions
Buttons:
Call
WhatsApp
Email
Reassign
Transfer
Convert to Customer
Archive Request

UX Notes
Reseller Admin can do sales actions too.
Reassign should be visible but not intrusive.
Important Details must be visible, not buried.
Timeline should clearly show team actions.

## 14. Important Details Management

This is a key UI feature you requested.

Route
/reseller/settings/important-details

Purpose
Reseller Admin can customize what sales users see on lead call screen.

Form
Important Details Title
Important Details Body
Apply To:
- All leads
- Specific country
- Specific source
- Specific priority

Example Content
Explain that resellers are partners, not sponsors.
Mention package options clearly.
Ask if customer needs invoice before contract.
Do not promise special discounts without approval.

UX Notes
Rich text editor or simple bullet editor.
Preview how it appears on sales call screen.
Super Admin can override or lock this section.
Keep version history if possible.

## 15. Customer Management for Reseller Admin

Route
/reseller/customers

Customer List Desktop Columns
Company
Contact
Country
Customer Status
Contract Status
Invoice Status
Balance
Assigned User
Last Activity
Actions

Mobile Card
ABC Logistics
Sarah Haddad
Contract Not Signed
Pending Invoice: $500
Assigned to John
[Open] [WhatsApp] [Invoice]

Filters
Contract Not Signed
Contract Signed
Deposit Paid
Fully Paid
Country
Assigned user
Payment status
Balance due
Recently converted
Custom fields

UX Notes
Customers should feel like a continuation of lead flow.
Show "next action" clearly.
Use progress status:
Contract
Deposit
Full Payment

## 16. Customer Detail Screen

Route
/reseller/customers/:id

Sections
Customer Summary
Contacts
Contract
Invoices
Receipts
Notes
Timeline
Attachments

Top Action Buttons
WhatsApp
Create Invoice
Upload Contract
Create Receipt
Add Note

UX Notes
Use customer progress bar:
Contract Not Signed
Contract Signed
Deposit Paid
Fully Paid
Keep invoices/receipts simple.
Show related documents clearly.
Preserve lead history.

## 17. Contract Upload Flow

Route
/reseller/customers/:id/contracts

Flow
Upload Contract
→ File saved to Google Drive
→ Contract linked to customer
→ Customer status updated if needed

UI
Show:
Contract Status
Uploaded Files
Upload New Contract
Google Drive Link
Last Updated

UX Notes
Show file preview if possible.
Show Google Drive sync status.
Allow multiple files if needed.
Show who uploaded and when.

## 18. Invoice Management for Reseller Admin

Route
/reseller/invoices

Invoice List Columns
Invoice #
Customer
Country
Amount
Currency
Status
Due Date
Payment Method
Created By
Actions
Actions:
Open
Download PDF
Send WhatsApp
Send Email
Create Receipt

UX Notes
Keep invoice list clean.
Payment status should be obvious:
unpaid
partially paid
paid
Avoid ERPNext accounting terms.
Use plain business language.

## 19. Create Invoice Flow

Route
/reseller/invoices/new

Flow
Select Customer
→ Select Country
→ Add Items / Amount
→ Select Currency
→ Set Due Date
→ Preview PDF
→ Save / Send

Invoice Fields
Customer
Country
Reseller
Item/service
Quantity
Unit price
Discount optional
Currency
Due date
Notes
Payment link optional

UX Notes
Use step-by-step wizard.
Preview invoice PDF before sending.
Auto-apply:
country branding
reseller branding if enabled
currency
invoice numbering
Buttons after creation:
Download PDF
Send WhatsApp
Send Email
Create Receipt

## 20. Receipt / Payment Flow

Route
From invoice detail:
Create Receipt

Flow
Select invoice
→ Enter amount
→ Choose payment method
→ Add reference
→ Upload proof optional
→ Save receipt

Payment Methods
Cash
Bank Transfer
OMT
Whish
Credit/Debit Card
Crypto

UX Notes
Payment method cards with icons.
Show remaining balance.
Support partial payments.
When fully paid, update customer status if appropriate.
Trigger auto-commission if reseller rule matches.

## 21. Commission UI for Reseller Admin

Route
/reseller/commissions

Purpose
Show reseller earnings, not full accounting.

Dashboard Cards
Pending Commission
Approved Commission
Paid Commission
Commission This Month

Table Columns
Date
Invoice
Customer
Country
Trigger
Invoice Amount
Commission %
Commission Amount
Status

Statuses
Pending
Approved
Paid
Cancelled / Reversed

UX Notes
Reseller Admin cannot change commission rules.
They can view commission history.
Show calculation transparently.
Use export button if allowed.

## 22. Team Management UI

Route
/reseller/team

Purpose
Manage reseller sales users.

Team List
Columns:
Name
Role
Assigned Countries
Active Leads
Follow-Ups Today
Converted This Month
Last Active
Status
Actions
Actions:
View
Edit
Deactivate
Assign Leads

UX Notes
Reseller Admin can manage team only if permission allows.
Show workload stats.
Keep user creation simple.
Do not expose global permission complexity.

Add Team Member Flow
Team
→ Add User
→ Enter name/email/phone
→ Select role
→ Assign countries
→ Create password
→ Save

UX Notes
Admin manually creates users.
Show password rules.
2FA can be final phase.
Country assignment limited to reseller's countries.

## 23. Calendar UI for Reseller Admin

Route
/reseller/calendar

Purpose
View team follow-ups and meetings.

Views
Today
Week
Month
Team agenda

Filters
Salesperson
Country
Event type
Priority

Event Types
Lead follow-up
Customer meeting
Contract reminder
Invoice due
Payment reminder

UX Notes
Default mobile view: agenda.
Admin can see team follow-ups.
Clicking event opens lead/customer.
Google Calendar sync status should be shown for users.

## 24. Reports UI for Reseller Admin

Route
/reseller/reports

Report Categories
Sales Pipeline
Team Performance
Invoices & Payments
Commissions
Lead Sources
Conversion Rates
Follow-Up Activity

UX Notes
Use cards and charts.
Do not overload with global finance.
Export CSV/Excel if permission allows.
Filters:
date range
country
salesperson
status
source

## 25. Reseller Settings UI

Route
/reseller/settings

Only show settings allowed by Super Admin.

Sections
Profile
Branding
Important Details
Notification Preferences
Payment Methods
Currencies
Calendar
Appearance

UX Notes
If setting is locked by Super Admin, show:
visible but read-only
"Controlled by Super Admin"
Reseller Admin should not access:
API Developer Center
Global country settings
global invoice numbering
global WhatsApp provider credentials
delete queue unless allowed

## 26. Notification UI

Reseller Admin Notifications
Events:
Lead assigned/unassigned
Lead transferred
Follow-up overdue
Invoice created
Receipt created
Contract uploaded
Customer fully paid
Commission generated
WhatsApp failed
Team inactive
Delete request submitted

UX Notes
Notifications should be actionable.
Clicking notification opens the related record.
Allow filters:
unread
leads
invoices
team
system

## 27. Global Search for Reseller Admin

Route
/reseller/search

Search Across
Leads
Customers
Invoices
Receipts
Team users
Contracts

UX Notes
Results must be permission-filtered.
Group results by module.
Show quick actions:
Open
Call
WhatsApp
Invoice

## 28. Reseller Admin Empty States

No Leads
No leads yet.
Add a lead manually or import a CSV to get started.
Buttons:
Add Lead
Import CSV

No Team Members
No sales users added yet.
Create your first sales user to start assigning leads.
Button:
Add Team Member

No Pending Invoices
No pending invoices.
All payments are currently up to date.

## 29. Reseller Admin Error States

Country Not Allowed
This reseller is not allowed to operate in this country.
Please select one of your assigned countries.

Permission Locked
This setting is controlled by the Super Admin.
You can view it, but cannot edit it.

Google Drive Contract Upload Failed
Contract upload failed.
Please check the Google Drive connection or try again.
Buttons:
Retry
Save Locally Temporarily

WhatsApp Failed
WhatsApp message could not be sent.
Check the phone number format or try again.
Buttons:
Retry
Copy Number
Open Customer

## 30. Reseller Admin Microinteractions

Important polish:
Reassign lead shows toast confirmation.
Transfer lead requires confirmation modal.
Import CSV shows progress.
Invoice PDF generation shows loading state.
WhatsApp send shows sent/failed status.
Contract upload shows upload progress.
Dashboard widgets are draggable.
Follow-up overdue cards pulse subtly or show urgent badge.
Commission generated shows notification.
"Save & Notify Team" option after changing assignment.
Filters should persist during session.

## 31. Permission-Based UI Behavior

The Reseller Admin UI must dynamically hide or lock sections based on Super Admin configuration.

Examples
If Super Admin disables reseller branding:
Branding section appears read-only or hidden.
If Super Admin disables invoice creation:
Create Invoice button is hidden.
If Super Admin locks payment methods:
Payment methods visible but not editable.
If Super Admin allows customer visibility across countries:
Customer list can show cross-country data based on rule.

## 32. Reseller Admin UX Compared to Sales User

Sales User UI
Focused on:
Call
WhatsApp
Follow-up
Update status
Convert

Reseller Admin UI
Focused on:
Assign
Monitor
Correct
Approve
Invoice
Report
Coach team

This difference is important.
Do not reuse the sales dashboard directly for reseller admin.
They share some components, but the priorities are different.

## 33. Recommended Component System

Create reusable components:
LeadCard
LeadTable
CustomerCard
InvoiceCard
StatusBadge
PriorityBadge
UserWorkloadBadge
FollowUpCard
CommissionSummaryCard
ImportantDetailsCard
Timeline
QuickActionBar
FilterDrawer
MobileActionSheet

## 34. Reseller Admin Final Codex Instruction

Use this focused instruction for Codex:
Build the Reseller Admin interface as an operational team-control dashboard.
The Reseller Admin must be able to:
- monitor all leads under their reseller
- assign/reassign leads
- transfer leads when permitted
- manage team members
- view workload and performance
- manage customers
- create invoices and receipts
- view commissions
- configure Important Details shown to sales users
- upload contracts
- view team calendar
- access reseller-level reports
The UI must be mobile-responsive but optimized for management workflows on desktop and tablet.
The dashboard should prioritize:
1. today's actions
2. overdue follow-ups
3. unassigned leads
4. interested leads
5. pending invoices
6. contracts not signed
7. team performance
8. commission summary
Do not expose ERPNext UI or complexity.
Keep all accounting/invoicing flows simple and business-friendly.
