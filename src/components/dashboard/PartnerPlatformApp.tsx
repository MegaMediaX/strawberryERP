"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  Moon,
  PhoneCall,
  Plus,
  Search,
  Send,
  Settings2,
  Shield,
  Sun,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  allowedCountries,
  auditEvents,
  blockedCountries,
  commissionRows,
  countryPerformance,
  dashboardMetrics,
  integrationHealth,
  leadStatuses,
  navigation,
  pipeline,
  revenueSeries,
  type Country,
  type LeadStatus,
  type Role,
} from "@/lib/sample-data";
import type { PortalSession } from "@/lib/portal-security";
import type { PortalLead } from "@/lib/ui-data";
import { cn } from "@/lib/utils";

type CountryFilter = "All countries" | Country;
type DateFilter = "Today" | "7 days" | "30 days" | "Quarter";

const statusTone: Record<LeadStatus, "neutral" | "green" | "amber" | "blue" | "rose" | "violet"> = {
  "New Lead (Uncontacted)": "blue",
  "Attempted Contact (No Response)": "amber",
  "Contacted (Awaiting Response)": "neutral",
  "Contacted (Not Interested)": "rose",
  "Contacted (Interested)": "green",
  "Scheduled Follow-Up": "violet",
};

const metricToneClasses: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export function PartnerPlatformApp({ initialLeads, loadError, session, source }: {
  initialLeads: PortalLead[];
  loadError?: string;
  session: PortalSession;
  source: "frappe" | "dev-store";
}) {
  const [darkMode, setDarkMode] = useState(false);
  const [activeRole] = useState<Role>(session.effectiveUser.role);
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("All countries");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30 days");
  const [query, setQuery] = useState("");
  const [activeLeadId, setActiveLeadId] = useState(initialLeads[0]?.id ?? "");
  const [statusByLead, setStatusByLead] = useState<Record<string, LeadStatus>>(
    Object.fromEntries(initialLeads.map((lead) => [lead.id, lead.status])) as Record<string, LeadStatus>,
  );
  const [callLogged, setCallLogged] = useState(false);

  const visibleLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return initialLeads.filter((lead) => {
      const matchesCountry = countryFilter === "All countries" || lead.country === countryFilter;
      const matchesQuery =
        !normalized ||
        [lead.company, lead.contact, lead.email, lead.phone, lead.reseller, lead.assignedTo, lead.source]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      if (activeRole === "Regional Director") {
        return matchesCountry && lead.country === (countryFilter === "All countries" ? "Lebanon" : countryFilter) && matchesQuery;
      }

      if (activeRole === "Sales Team User") {
        return matchesCountry && lead.assignedTo === "Rami K." && matchesQuery;
      }

      return matchesCountry && matchesQuery;
    });
  }, [activeRole, countryFilter, initialLeads, query]);

  const activeLead = visibleLeads.find((lead) => lead.id === activeLeadId) ?? visibleLeads[0];
  const activeLeadStatus = activeLead ? (statusByLead[activeLead.id] ?? activeLead.status) : undefined;
  const visibleNavigation = navigation.filter((item) => {
    if (session.effectiveUser.role === "Super Admin") return true;
    if (session.effectiveUser.role === "Sales Team User") return ["/", "/leads", "/customers"].includes(item.href);
    return !item.href.startsWith("/settings");
  });

  function updateActiveLeadStatus(status: LeadStatus) {
    if (!activeLead) {
      return;
    }
    setStatusByLead((current) => ({ ...current, [activeLead.id]: status }));
    setCallLogged(false);
  }

  function focusMetric(label: string) {
    if (label.includes("follow-up")) {
      setQuery("Scheduled Follow-Up");
      return;
    }
    if (label.includes("Revenue") || label.includes("Pending invoices") || label.includes("Receipts")) {
      setCountryFilter("All countries");
      setDateFilter("30 days");
      return;
    }
    if (label.includes("Top reseller")) {
      setQuery("Beirut Digital Partners");
    }
  }

  return (
    <div className={cn(darkMode && "dark")}>
      <div className="min-h-screen bg-[var(--app-bg)] text-slate-950 transition-colors dark:text-slate-50">
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] min-w-0 flex-col lg:flex-row">
          <aside className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
            <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-stretch">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Building2 aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">LebTech</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">Partner Platform</p>
                </div>
              </div>

              <nav className="hidden flex-col gap-1 lg:flex">
                {visibleNavigation.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <a
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white",
                        index === 0 && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white dark:bg-white dark:text-slate-950",
                      )}
                      href={item.href}
                      key={item.label}
                    >
                      <Icon aria-hidden="true" />
                      {item.label}
                    </a>
                  );
                })}
              </nav>

              <Button
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => setDarkMode((current) => !current)}
                size="icon"
                variant="secondary"
              >
                {darkMode ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
              </Button>
            </div>

            <div className="mt-4 hidden rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 lg:block">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Shield aria-hidden="true" />
                Tenant guardrails
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Users stay in this portal. ERPNext remains the permission engine, accounting backbone, and API layer.
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-3xl">
                  Partner operations dashboard
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Reseller CRM, invoicing, commissions, communications, API access, and country governance in one white-label interface.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="gap-1.5" tone="blue">
                    <Database aria-hidden="true" className="size-3.5" />
                    Source: {source}
                  </Badge>
                  <Badge tone="green">Role: {activeRole}</Badge>
                  <Badge tone="neutral">Window: {dateFilter}</Badge>
                </div>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_180px_180px_150px] 2xl:w-[920px]">
                <label className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label="Global search"
                    className="pl-10"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search records..."
                    value={query}
                  />
                </label>

                <Select aria-label="Role" disabled value={activeRole}>
                  <option>{activeRole}</option>
                </Select>

                <Select
                  aria-label="Country"
                  onChange={(event) => setCountryFilter(event.target.value as CountryFilter)}
                  value={countryFilter}
                >
                  <option>All countries</option>
                  {allowedCountries.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </Select>

                <Select aria-label="Date range" onChange={(event) => setDateFilter(event.target.value as DateFilter)} value={dateFilter}>
                  {(["Today", "7 days", "30 days", "Quarter"] as const).map((range) => (
                    <option key={range}>{range}</option>
                  ))}
                </Select>
              </div>
            </header>

            {loadError ? (
              <Card className="mt-5">
                <CardHeader>
                  <CardTitle>Operational data unavailable</CardTitle>
                  <CardDescription>{loadError}</CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            <section className="grid gap-4 py-5 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card
                    className="cursor-pointer transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    key={metric.label}
                    onClick={() => focusMetric(metric.label)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        focusMetric(metric.label);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <CardHeader className="flex-row items-start justify-between gap-4">
                      <div>
                        <CardDescription>{metric.label}</CardDescription>
                        <CardTitle className="mt-2 text-2xl">{metric.value}</CardTitle>
                      </div>
                      <div className={cn("grid size-11 place-items-center rounded-lg", metricToneClasses[metric.tone])}>
                        <Icon aria-hidden="true" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.delta}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Country performance</CardTitle>
                      <CardDescription>Revenue and invoice velocity across active markets.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary">
                        <Download data-icon="inline-start" />
                        Export
                      </Button>
                      <Button size="sm">
                        <Plus data-icon="inline-start" />
                        New invoice
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-6 xl:grid-cols-[1fr_320px]">
                    <MeasuredChart height={260}>
                      {(width) => (
                          <AreaChart data={revenueSeries} height={260} margin={{ bottom: 0, left: 0, right: 8, top: 8 }} width={width}>
                            <defs>
                              <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="var(--chart-blue)" stopOpacity={0.34} />
                                <stop offset="95%" stopColor="var(--chart-blue)" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                            <XAxis axisLine={false} dataKey="month" tickLine={false} />
                            <YAxis axisLine={false} tickFormatter={(value) => `$${Number(value) / 1000}k`} tickLine={false} width={54} />
                            <Tooltip
                              contentStyle={{
                                background: "var(--tooltip-bg)",
                                border: "1px solid var(--tooltip-border)",
                                borderRadius: "8px",
                                color: "var(--tooltip-text)",
                              }}
                              formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                            />
                            <Area
                              dataKey="revenue"
                              fill="url(#revenueGradient)"
                              stroke="var(--chart-blue)"
                              strokeWidth={3}
                              type="monotone"
                            />
                          </AreaChart>
                      )}
                    </MeasuredChart>

                    <div className="grid gap-3">
                      {countryPerformance.map((country) => (
                        <button
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                          key={country.country}
                          onClick={() => setCountryFilter(country.country as Country)}
                          type="button"
                        >
                          <div>
                            <p className="text-sm font-semibold">{country.country}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {country.leads} leads · {country.invoices} invoices
                            </p>
                          </div>
                          <p className="text-sm font-semibold">${(country.revenue / 1000).toFixed(1)}k</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Lead command center</CardTitle>
                      <CardDescription>Filtered by role, country, and global search. DELETE is intentionally absent.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary">
                        <Upload data-icon="inline-start" />
                        CSV import
                      </Button>
                      <Button size="sm">
                        <Plus data-icon="inline-start" />
                        New lead
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="py-3 pr-4 font-medium">Lead</th>
                            <th className="py-3 pr-4 font-medium">Country</th>
                            <th className="py-3 pr-4 font-medium">Assigned</th>
                            <th className="py-3 pr-4 font-medium">Status</th>
                            <th className="py-3 pr-4 font-medium">Follow-up</th>
                            <th className="py-3 text-right font-medium">Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLeads.map((lead) => {
                            const status = statusByLead[lead.id] ?? lead.status;
                            return (
                              <tr
                                className={cn(
                                  "border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/70",
                                  lead.id === activeLead.id && "bg-slate-50 dark:bg-slate-900",
                                )}
                                key={lead.id}
                              >
                                <td className="py-4 pr-4">
                                  <p className="font-semibold text-slate-950 dark:text-white">{lead.company}</p>
                                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {lead.contact} · {lead.phone}
                                  </p>
                                </td>
                                <td className="py-4 pr-4">{lead.country}</td>
                                <td className="py-4 pr-4">{lead.assignedTo}</td>
                                <td className="py-4 pr-4">
                                  <Badge tone={statusTone[status]}>{status}</Badge>
                                </td>
                                <td className="py-4 pr-4">{lead.followUp}</td>
                                <td className="py-4 text-right">
                                  <Button
                                    onClick={() => {
                                      setActiveLeadId(lead.id);
                                      setCallLogged(false);
                                    }}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    View
                                    <ChevronRight data-icon="inline-end" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                          {!visibleLeads.length ? (
                            <tr>
                              <td className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                                No leads match the current role, country, and search filters.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Mobile call screen</CardTitle>
                    <CardDescription>Sales-first workflow with follow-up enforcement.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {activeLead ? (
                    <>
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{activeLead.company}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{activeLead.contact}</p>
                        </div>
                        <Badge tone={activeLead.priority === "VIP" ? "rose" : "neutral"}>{activeLead.priority}</Badge>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
                          <dd className="font-medium">{activeLead.phone}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                          <dd className="font-medium">{activeLead.email}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500 dark:text-slate-400">Reseller</dt>
                          <dd className="text-right font-medium">{activeLead.reseller}</dd>
                        </div>
                      </dl>
                    </div>

                    <Button className="h-14 text-base" onClick={() => setCallLogged(true)}>
                      <PhoneCall data-icon="inline-start" />
                      Call {activeLead.contact.split(" ")[0]}
                    </Button>

                    {callLogged ? (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 aria-hidden="true" />
                        Call activity logged to timeline and audit log.
                      </div>
                    ) : null}

                    <Field
                      description={activeLeadStatus === "Scheduled Follow-Up" ? "Follow-up date is required and syncs to Calendar." : undefined}
                      label="Current status"
                    >
                      <Select
                        onChange={(event) => updateActiveLeadStatus(event.target.value as LeadStatus)}
                        value={activeLeadStatus}
                      >
                        {leadStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Follow-up date">
                      <Input
                        defaultValue={activeLead.followUp === "Unscheduled" ? "" : activeLead.followUp}
                        key={`${activeLead.id}-follow-up`}
                        placeholder="Required for scheduled follow-up"
                      />
                    </Field>

                    <Field label="Important details">
                      <Textarea defaultValue={activeLead.notes} key={`${activeLead.id}-notes`} />
                    </Field>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button variant="secondary">
                        <MessageActionIcon />
                        WhatsApp
                      </Button>
                      <Button variant="secondary">
                        <Send data-icon="inline-start" />
                        Email
                      </Button>
                    </div>
                    </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Select a broader country, role, date window, or search term to load a lead workflow.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Lead pipeline</CardTitle>
                    <CardDescription>Status mix for the current operational window.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MeasuredChart height={220}>
                      {(width) => (
                          <BarChart data={pipeline} height={220} margin={{ bottom: 0, left: 0, right: 8, top: 8 }} width={width}>
                            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                            <XAxis axisLine={false} dataKey="status" tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} width={32} />
                            <Tooltip
                              contentStyle={{
                                background: "var(--tooltip-bg)",
                                border: "1px solid var(--tooltip-border)",
                                borderRadius: "8px",
                                color: "var(--tooltip-text)",
                              }}
                            />
                            <Bar dataKey="leads" fill="var(--chart-emerald)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                      )}
                    </MeasuredChart>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-5 py-5 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Commission control</CardTitle>
                  <CardDescription>Automatic rules set at reseller creation.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {commissionRows.map((row) => (
                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800" key={row.reseller}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{row.reseller}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Trigger: {row.trigger}</p>
                        </div>
                        <CircleDollarSign aria-hidden="true" className="text-emerald-600" />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Pending {row.pending}
                        </p>
                        <p className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Paid {row.paid}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Provider setup lives under Super Admin settings.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {integrationHealth.map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div className="flex items-start gap-3" key={integration.name}>
                        <div className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <Icon aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{integration.name}</p>
                          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {integration.state} · {integration.detail}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security and audit</CardTitle>
                  <CardDescription>Soft-delete queue, impersonation, and API usage trails.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle aria-hidden="true" />
                      Blocked country guard
                    </div>
                    <p className="mt-1 text-xs leading-5">Cannot add: {blockedCountries.join(", ")}.</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {auditEvents.map((event) => (
                      <div className="flex gap-3 text-sm" key={event}>
                        <Bell aria-hidden="true" className="mt-0.5 text-slate-400" />
                        <p className="leading-5 text-slate-600 dark:text-slate-300">{event}</p>
                      </div>
                    ))}
                  </div>

                  <Button variant="danger">
                    <Settings2 data-icon="inline-start" />
                    Open delete queue
                  </Button>
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function MessageActionIcon() {
  return (
    <svg aria-hidden="true" data-icon="inline-start" fill="none" viewBox="0 0 24 24">
      <path
        d="M6.5 18.5 4 20l.8-3.1A7.4 7.4 0 0 1 3.5 12.5C3.5 8.36 7.31 5 12 5s8.5 3.36 8.5 7.5S16.69 20 12 20a9.5 9.5 0 0 1-5.5-1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8.5 11h7M8.5 14h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MeasuredChart({
  children,
  height,
}: {
  children: (width: number) => ReactNode;
  height: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(Math.max(0, Math.floor(element.clientWidth)));
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-w-0" ref={ref} style={{ height }}>
      {width > 0 ? children(width) : <div className="h-full rounded-lg bg-slate-100 dark:bg-slate-900" />}
    </div>
  );
}
