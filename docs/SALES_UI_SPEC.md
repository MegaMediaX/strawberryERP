# Sales Team UI — Deep UX Specification

This is the most important part of the platform because sales users will live here every day. The UI must be fast, mobile-first, action-focused, and almost impossible to get lost in.
The sales team should not feel like they are using a CRM.
They should feel like they are using a daily calling and follow-up assistant.

## 1. Sales User Core Principle

Main Goal
A sales user logs in and immediately knows:
Who should I call now?
Who is overdue?
Who is interested?
Who needs follow-up?
Who can be converted?
The UI should push them toward the next action.

## 2. Sales User Home Dashboard

Route
/sales/dashboard

Main Layout
Desktop
Top Bar
├── Global Search
├── Quick Add Lead
├── Notifications
└── Profile
Main Area
├── Today Focus Panel
├── My Lead Pipeline
├── Follow-Up Queue
├── Recent Activity
└── Quick Stats

Mobile
Top Header
├── Greeting
├── Search Icon
└── Notification Icon
Main Cards
├── Today's Calls
├── Overdue Follow-Ups
├── Interested Leads
├── Scheduled Follow-Ups
└── Recent Leads
Bottom Navigation
├── Home
├── Leads
├── Follow-Ups
├── Search
└── Profile

## 3. Sales Dashboard Widgets

Priority Order
The sales dashboard should not start with revenue.
It should start with work to do today.

Recommended Widgets
| Priority | Widget | Purpose |
| --- | --- | --- |
| 1 | Today's Follow-Ups | Most urgent action |
| 2 | Overdue Follow-Ups | Recover missed work |
| 3 | Interested Leads | Highest conversion chance |
| 4 | New Leads | Fresh contacts |
| 5 | Attempted / No Response | Retry queue |
| 6 | Recently Updated | Continue active conversations |
| 7 | Converted This Month | Motivation |
| 8 | My Performance | Simple personal stats |

## 4. Dashboard Hero Card

At the top, show a clear daily summary.
Example
Good morning, John
You have:
7 follow-ups today
3 overdue leads
12 new leads
5 interested leads
Buttons:
Start Calling
View Follow-Ups
Add Lead

UX Notes
"Start Calling" should open the next best lead.
The system should choose lead priority:
VIP overdue
overdue follow-up
today follow-up
interested lead
new lead

## 5. Start Calling Flow

Route
/sales/calling

Purpose
This is a focused sales mode.
The user should move from lead to lead like a calling queue.

Flow
Dashboard
→ Start Calling
→ Lead Call Screen
→ Call / WhatsApp
→ Update status
→ Add note
→ Save & Next
→ Next lead appears

## 6. Calling Mode UI

Desktop Layout
```
------------------------------------------------
| Lead Queue Progress: 4 of 28                 |
------------------------------------------------
| Company Name                                  |
| Contact Name + Gender                         |
| Phone | Email                                 |
| Country | Source | Priority                   |
------------------------------------------------
| BIG CALL BUTTON | BIG WHATSAPP BUTTON         |
------------------------------------------------
| Status Update                                 |
| Follow-Up Date                                |
| Notes                                         |
------------------------------------------------
| Important Details                             |
| Activity Timeline                             |
------------------------------------------------
| Skip | Save | Save & Next                     |
------------------------------------------------
```

Mobile Layout
Company Name
Contact Name
[CALL]
[WHATSAPP]
Status
Follow-Up Date
Notes
Important Details
[Save & Next]

UX Notes
Call button must be the largest action.
WhatsApp button should be second.
Phone number must be visible without scrolling.
Status must be editable in one tap.
Notes should be quick to add.
Save & Next should keep workflow moving.
Avoid opening many pages.

## 7. Lead Call Screen Details

Route
/sales/leads/:id

Top Section
Show:
Company Name
Contact First Name + Last Name
Gender badge
Priority badge
Status badge
Example:
ABC Logistics
Sarah Haddad · Female
VIP · Contacted Interested

Contact Action Panel
This panel should stay visible.
Desktop
Sticky right panel.
Mobile
Sticky bottom action bar.
Buttons:
Call
WhatsApp
Email
Copy Number

UX Notes
Call and WhatsApp should use native links on mobile.
Example:
tel:+961...
WhatsApp deep link or API action
Copy number button helps desktop users.

## 8. Important Details Section

This is one of your key UX notes.
Location
On the lead screen, directly under contact actions.
Purpose
Shows sales instructions written by Reseller Admin or Super Admin.
Example:
Important Details
- Explain that resellers are partners, not sponsors.
- Mention early-bird registration package.
- Ask if invoice should be issued before contract.
- Do not promise discounts without admin approval.

UX Notes
Must be visible before notes.
Should not be hidden in tabs.
Use a highlighted card.
Can be pinned.
On mobile, show as collapsible but expanded by default.
Admin can edit the content globally or per reseller.

## 9. Lead Status Update UI

Status Dropdown
Should be large and readable.
Statuses:
New Lead
Attempted Contact - No Response
Contacted - Awaiting Response
Contacted - Not Interested
Contacted - Interested
Scheduled Follow-Up

Recommended UI
Use status cards or dropdown.
Mobile
Better as bottom sheet:
Choose Status
○ New Lead
○ Attempted Contact
○ Awaiting Response
○ Not Interested
○ Interested
○ Scheduled Follow-Up

Rule
If user selects:
Scheduled Follow-Up
Then show required fields:
Follow-Up Date
Follow-Up Time
Reminder Channel
Notes

## 10. Quick Outcome Buttons

To speed up calling, add quick outcome buttons.
Buttons
No Answer
Interested
Not Interested
Call Later
Wrong Number
Converted

What They Do
| Button | Auto Action |
| --- | --- |
| No Answer | Sets status to Attempted Contact |
| Interested | Sets status to Contacted Interested |
| Not Interested | Sets status to Contacted Not Interested |
| Call Later | Opens follow-up date picker |
| Wrong Number | Flags lead data issue |
| Converted | Opens convert to customer flow |

UX Notes
These should appear after call/WhatsApp action.
They reduce clicks.
They make sales work faster.

## 11. Notes UI

Notes Should Be Fast
Sales users should never write long reports unless needed.

Recommended Notes Section
Quick Note
[textarea]
Quick Templates:
[No answer]
[Asked to call tomorrow]
[Requested invoice]
[Interested but needs approval]
[Wrong number]

UX Notes
Notes should autosave as draft.
Timestamp notes.
Show user who wrote note.
Latest notes first.
Allow voice note upload later if needed.

## 12. Timeline UI

Timeline Purpose
Shows history of everything that happened.
Example:
Today 10:24
John called lead
Status changed to Interested
Note: Asked for proposal on WhatsApp
Yesterday 15:12
Follow-up scheduled for today
June 12
Lead imported by CSV

Timeline Events
Track:
Lead created
Lead assigned
Status changed
Note added
Follow-up scheduled
WhatsApp sent
Email sent
Call logged
Lead transferred
Converted to customer

UX Notes
Keep timeline under notes.
Collapsed by default on mobile.
Show most recent activity first.
Use icons for event types.

## 13. Follow-Up Queue UI

Route
/sales/follow-ups

Purpose
This is the salesperson's daily work queue.

Tabs
Today
Overdue
Tomorrow
This Week
All

Card Layout
Each follow-up card shows:
Company Name
Contact Name
Phone
Status
Priority
Follow-up time
Last note
[Call] [WhatsApp] [Open]

UX Notes
Follow-ups should be ordered by urgency.
Overdue should be visually obvious.
VIP leads should float to the top.
One-tap Call/WhatsApp.
No table on mobile.

## 14. My Leads List UI

Route
/sales/leads

Views
Desktop
Use table with filters.
Columns:
Company
Contact
Phone
Status
Priority
Country
Source
Follow-Up
Last Activity
Actions

Mobile
Use cards.
Card:
ABC Logistics
Sarah Haddad
Interested · VIP
Follow-up today 3:00 PM
[Call] [WhatsApp] [Open]

## 15. Lead Filters for Sales Users

Sales users should only see filters relevant to them.
Filters
Status
Priority
Source
Follow-up date
Country
Tags
Recently updated
No activity
Overdue

UX Notes
Default filter should be "My Active Leads".
Add saved views:
My Follow-Ups Today
Interested
No Response
VIP
Recently Added

## 16. Add Lead UI for Sales User

Route
/sales/leads/new

Form Sections
Company
Contact
Assignment
Extra

Required Fields
Company Name
Country
Assigned User
Contact First Name
Contact Last Name
Gender
Phone
Email
For sales users, Assigned User can default to themselves.

UX Notes
Keep it short.
Use mobile-friendly form.
Put optional fields in collapsed section.
Save button sticky at bottom on mobile.

## 17. Convert Lead to Customer UI

Flow
Lead Detail
→ Convert to Customer
→ Confirm details
→ Set customer status
→ Save

Confirmation Screen
Show:
Company Name
Contact Name
Phone
Email
Country
Reseller
Assigned User
Initial Customer Status

Initial Customer Status Options
Contract Not Signed
Contract Signed
Deposit Paid
Fully Paid

UX Notes
Do not make conversion complicated.
Preserve all notes and timeline.
After conversion, show:
Go to Customer
Create Invoice
Upload Contract

## 18. Sales Customer View UI

Sales users may need a simple customer screen.
Route
/sales/customers/:id

UI Sections
Customer Summary
Contacts
Contract Status
Invoices
Receipts
Notes
Timeline

UX Notes
Keep financial info limited based on permission.
Show clear next action:
Upload Contract
Create Invoice
Send WhatsApp
Add Note

## 19. Sales Invoice UI

If the sales user has permission to create invoices, it must be simplified.
Flow
Customer
→ Create Invoice
→ Add amount/items
→ Select currency
→ Preview
→ Send

UX Notes
Do not expose ERPNext accounting complexity.
Use simple fields:
item/service
amount
currency
due date
notes
Show preview before sending.
Buttons:
Download PDF
Send WhatsApp
Send Email

## 20. Sales Notifications UI

Notification Types
Sales users receive:
Follow-up due
Follow-up overdue
Lead assigned
Lead transferred to them
WhatsApp failed
Invoice sent
Customer status changed

UI
Top notification bell.
Mobile push-style in-app list:
Notifications
- Follow-up due: ABC Logistics at 3:00 PM
- New lead assigned: XYZ Trading
- WhatsApp failed: invalid number

UX Notes
Notifications should be action-based.
Each notification opens the related lead/customer.
Avoid spam.

## 21. Sales Calendar UI

Route
/sales/calendar

Purpose
Shows scheduled follow-ups and meetings.

Views
Today
Week
Month

Calendar Items
Lead follow-up
Customer meeting
Invoice due
Payment reminder
Contract reminder

UX Notes
Google Calendar sync status should appear in profile/settings.
Calendar items should open the lead/customer.
On mobile, default to agenda view.

## 22. Sales Profile UI

Route
/sales/profile

Sections
Account
Appearance
Calendar Integration
Notification Preferences
Security

User Can
Change light/dark mode
Connect Google Calendar
View assigned role
View timezone
Manage notification preference if allowed
Enable 2FA in final stage

UX Notes
Keep settings simple.
Do not show admin settings.
If Super Admin locks notification rules, show them as read-only.

## 23. Sales Global Search UI

Route
Accessible from top bar or bottom nav.

Search Results
Group results by:
Leads
Customers
Invoices
Receipts
Sales user should only see records they are allowed to access.

Search Result Card
ABC Logistics
Lead · Interested · VIP
Sarah Haddad
[Open] [Call]

UX Notes
Search must be fast.
Show recent searches.
On mobile, search should be full-screen.

## 24. Mobile Bottom Navigation for Sales

Recommended
Home
Leads
Follow-Ups
Search
Profile

Optional Floating Button
Floating button:
+
Actions:
Add Lead
Log Note
Schedule Follow-Up

## 25. Empty States

Good empty states are important.

No Leads
No leads assigned yet.
Once leads are assigned to you, they will appear here.

No Follow-Ups
You have no follow-ups today.
Great job staying on top of your pipeline.

No Interested Leads
No interested leads yet.
Mark leads as interested after a successful call.

## 26. Error States

WhatsApp Failed
WhatsApp message could not be sent.
Check the number format or try again later.
Buttons:
Retry
Copy Number
Open Lead

Calendar Not Connected
Your Google Calendar is not connected.
Follow-ups will stay inside the platform only.
Button:
Connect Calendar

Missing Follow-Up Date
Please select a follow-up date before saving this status.

## 27. Sales UI Microinteractions

Small details that make the UI feel professional:
Status changes show instant confirmation.
Save & Next has loading state.
Call button logs "call attempted".
WhatsApp button logs "WhatsApp opened/sent".
Follow-up date picker defaults to tomorrow.
Overdue follow-ups show red/urgent treatment.
VIP leads get a clear badge.
Converted leads show success animation.
Notes autosave draft while typing.

## 28. Sales User Permissions in UI

Hide anything the user cannot do.
Do not show disabled admin buttons unless useful.

Sales User Can See
assigned leads
assigned customers
their follow-ups
their calendar
their notes
allowed invoices

Sales User Cannot See
global settings
API center
commission settings
country settings
reseller financial reports
delete queue
user management

## 29. Sales UI Routes Summary

/sales/dashboard
/sales/leads
/sales/leads/new
/sales/leads/:id
/sales/calling
/sales/follow-ups
/sales/customers
/sales/customers/:id
/sales/calendar
/sales/search
/sales/profile

Optional if invoice permission enabled:
/sales/invoices/new
/sales/invoices/:id

## 30. Codex Build Notes for Sales UI

Use this as a focused implementation instruction:
Build the Sales Team interface as a mobile-first action dashboard, not a traditional CRM.
The sales user experience must prioritize:
1. today's follow-ups
2. overdue leads
3. interested leads
4. calling workflow
5. quick status updates
6. WhatsApp/call actions
7. simple notes
8. conversion to customer

The lead call screen is the most important screen.
It must show:
- company name
- contact first name
- contact last name
- gender
- phone
- email
- big call button
- big WhatsApp button
- status selector
- follow-up date
- quick note input
- important details section
- activity timeline

The sales user should be able to call, update, save, and move to the next lead with minimal clicks.
