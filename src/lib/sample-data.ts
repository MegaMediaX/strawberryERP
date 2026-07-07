import {
  BadgeDollarSign,
  CalendarClock,
  FileText,
  Globe2,
  HandCoins,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const allowedCountries = ["Lebanon", "Cyprus", "Jordan", "Syria"] as const;
export const blockedCountries = ["Israel"] as const;

export const roles = [
  "Super Admin",
  "Regional Director",
  "Reseller Admin",
  "Sales Team User",
] as const;

export type Country = (typeof allowedCountries)[number];
export type Role = (typeof roles)[number];

export const leadStatuses = [
  "New Lead (Uncontacted)",
  "Attempted Contact (No Response)",
  "Contacted (Awaiting Response)",
  "Contacted (Not Interested)",
  "Contacted (Interested)",
  "Scheduled Follow-Up",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export const dashboardMetrics = [
  {
    label: "Leads needing follow-up",
    value: "38",
    delta: "+12 today",
    icon: CalendarClock,
    tone: "amber",
  },
  {
    label: "Revenue this month",
    value: "$184.6k",
    delta: "+18.4%",
    icon: BadgeDollarSign,
    tone: "emerald",
  },
  {
    label: "Pending invoices",
    value: "74",
    delta: "$49.2k open",
    icon: ReceiptText,
    tone: "blue",
  },
  {
    label: "WhatsApp pending actions",
    value: "21",
    delta: "6 reminders due",
    icon: MessageCircle,
    tone: "violet",
  },
  {
    label: "New leads today",
    value: "12",
    delta: "4 from WhatsApp",
    icon: UsersRound,
    tone: "blue",
  },
  {
    label: "Interested leads",
    value: "36",
    delta: "18 ready for quote",
    icon: Sparkles,
    tone: "emerald",
  },
  {
    label: "Unsigned contracts",
    value: "9",
    delta: "Google Drive pending",
    icon: FileText,
    tone: "amber",
  },
  {
    label: "Receipts issued",
    value: "42",
    delta: "$126.2k collected",
    icon: ReceiptText,
    tone: "emerald",
  },
  {
    label: "Top reseller",
    value: "Beirut",
    delta: "$72k revenue",
    icon: HandCoins,
    tone: "blue",
  },
  {
    label: "Commissions pending",
    value: "$14.5k",
    delta: "7 approvals",
    icon: BadgeDollarSign,
    tone: "amber",
  },
  {
    label: "Overdue follow-ups",
    value: "7",
    delta: "Requires action",
    icon: CalendarClock,
    tone: "violet",
  },
] as const;

export const countryPerformance = [
  { country: "Lebanon", leads: 122, revenue: 72000, invoices: 41 },
  { country: "Cyprus", leads: 74, revenue: 48500, invoices: 26 },
  { country: "Jordan", leads: 96, revenue: 39200, invoices: 31 },
  { country: "Syria", leads: 53, revenue: 24900, invoices: 15 },
];

export const pipeline = [
  { status: "New", leads: 44, color: "var(--chart-blue)" },
  { status: "Attempted", leads: 29, color: "var(--chart-amber)" },
  { status: "Interested", leads: 36, color: "var(--chart-emerald)" },
  { status: "Follow-up", leads: 38, color: "var(--chart-violet)" },
  { status: "Won", leads: 18, color: "var(--chart-rose)" },
];

export const revenueSeries = [
  { month: "Jan", revenue: 82000, commission: 9600 },
  { month: "Feb", revenue: 96000, commission: 11600 },
  { month: "Mar", revenue: 108000, commission: 13200 },
  { month: "Apr", revenue: 124000, commission: 15100 },
  { month: "May", revenue: 161000, commission: 19400 },
  { month: "Jun", revenue: 184600, commission: 22100 },
];

export const leads = [
  {
    id: "LEAD-2408",
    company: "Cedar Cloud Services",
    contact: "Maya Haddad",
    gender: "Female",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "Marven El Mouallem",
    phone: "+961 70 144 221",
    email: "maya@cedarcloud.example",
    priority: "VIP",
    status: "Scheduled Follow-Up" as LeadStatus,
    followUp: "Today, 16:30",
    source: "WhatsApp",
    notes: "Needs managed hosting, invoice in USD, contract draft pending.",
  },
  {
    id: "LEAD-2409",
    company: "Nicosia Retail Group",
    contact: "Andreas Kyriacou",
    gender: "Male",
    country: "Cyprus",
    reseller: "MedTech Channel CY",
    assignedTo: "Lina S.",
    phone: "+357 99 620 814",
    email: "andreas@nrg.example",
    priority: "High",
    status: "Contacted (Interested)" as LeadStatus,
    followUp: "Tomorrow, 10:00",
    source: "CSV Import",
    notes: "Interested in white-label invoices and card payments.",
  },
  {
    id: "LEAD-2410",
    company: "Amman Logistics Hub",
    contact: "Omar Naser",
    gender: "Male",
    country: "Jordan",
    reseller: "Levant Growth Systems",
    assignedTo: "Nour A.",
    phone: "+962 79 411 5570",
    email: "omar@alh.example",
    priority: "Medium",
    status: "Attempted Contact (No Response)" as LeadStatus,
    followUp: "Jun 10, 12:00",
    source: "API",
    notes: "Imported through developer center. No delete access allowed.",
  },
  {
    id: "LEAD-2411",
    company: "Damascus Design Office",
    contact: "Hala Mansour",
    gender: "Female",
    country: "Syria",
    reseller: "Sham Partner Desk",
    assignedTo: "Karim T.",
    phone: "+963 944 103 881",
    email: "hala@ddo.example",
    priority: "Low",
    status: "New Lead (Uncontacted)" as LeadStatus,
    followUp: "Unscheduled",
    source: "Manual",
    notes: "Needs first call and reseller permission review.",
  },
];

export const commissionRows = [
  { reseller: "Beirut Digital Partners", trigger: "Deposit paid", pending: "$7,420", paid: "$18,900" },
  { reseller: "MedTech Channel CY", trigger: "Invoice created", pending: "$4,180", paid: "$9,700" },
  { reseller: "Levant Growth Systems", trigger: "Fully paid", pending: "$2,910", paid: "$6,120" },
];

export const integrationHealth = [
  { name: "ERPNext API", state: "Connected", detail: "REST + custom whitelisted endpoints", icon: ShieldCheck },
  { name: "WhatsApp", state: "Queued", detail: "Meta Cloud API primary, Wasender fallback", icon: MessageCircle },
  { name: "Google Calendar", state: "OAuth ready", detail: "User-level follow-up sync", icon: CalendarClock },
  { name: "Google Drive", state: "Setup needed", detail: "Contract folder not selected", icon: FileText },
  { name: "SMTP", state: "Configured", detail: "Invoices, receipts, reminders", icon: ReceiptText },
  { name: "AI workflow layer", state: "Prepared", detail: "Lead scoring and summaries reserved", icon: Sparkles },
];

export const auditEvents = [
  "Marven El Mouallem changed LEAD-2408 to Scheduled Follow-Up",
  "Super Admin updated invoice numbering to country-based",
  "API key LT-DEV-03 created with read/write lead scopes",
  "Regional Director viewed Jordan country performance",
  "Delete request queued for stale receipt RCPT-1028",
];

export const navigation = [
  { label: "Dashboard", icon: Globe2, href: "/" },
  { label: "Leads", icon: UsersRound, href: "/leads" },
  { label: "Customers", icon: UsersRound, href: "/customers" },
  { label: "Invoices", icon: ReceiptText, href: "/accounting/invoices" },
  { label: "Receipts", icon: ReceiptText, href: "/accounting/receipts" },
  { label: "Commissions", icon: HandCoins, href: "/commissions" },
  { label: "WhatsApp", icon: MessageCircle, href: "/settings/integrations/whatsapp" },
  { label: "Calendar", icon: CalendarClock, href: "/settings/integrations/calendar" },
  { label: "API Center", icon: ShieldCheck, href: "/settings/api" },
  { label: "Reports", icon: FileText, href: "/reports" },
  { label: "Settings", icon: FileText, href: "/settings" },
] as const;
