"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { NewLeadForm } from "@/components/platform/NewLeadForm";
import type { PortalRole } from "@/lib/portal-security";
import { allowedCountries, leadStatuses } from "@/lib/sample-data";
import type { PortalLead } from "@/lib/ui-data";

export function LeadsWorkspace({ leads, role, source, error }: { leads: PortalLead[]; role: PortalRole; source: "frappe" | "dev-store"; error?: string }) {
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [country, setCountry] = useState("All countries");
  const [reseller, setReseller] = useState("All resellers");
  const [assignee, setAssignee] = useState("All users");
  const resellers = useMemo(() => [...new Set(leads.map((lead) => lead.reseller))].sort(), [leads]);
  const assignees = useMemo(() => [...new Set(leads.map((lead) => lead.assignedTo))].sort(), [leads]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads.filter((lead) =>
      (status === "All statuses" || lead.status === status)
      && (country === "All countries" || lead.country === country)
      && (reseller === "All resellers" || lead.reseller === reseller)
      && (assignee === "All users" || lead.assignedTo === assignee)
      && (!normalized || [lead.company, lead.contact, lead.email, lead.phone, lead.id].join(" ").toLowerCase().includes(normalized)),
    );
  }, [assignee, country, leads, query, reseller, status]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{visible.length} of {leads.length} leads</p>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)]"
        >
          {showNew ? "Close form" : "+ New lead"}
        </button>
      </div>

      {showNew ? <NewLeadForm onCreated={() => setShowNew(false)} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Lead filters</CardTitle>
              <CardDescription>Country, reseller, and assignment visibility remains constrained by the authenticated session.</CardDescription>
            </div>
            <Badge tone={source === "frappe" ? "green" : "amber"}>Source: {source}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Search"><Input aria-label="Search leads" onChange={(event) => setQuery(event.target.value)} placeholder="Company, contact, ID..." value={query} /></Field>
          <Field label="Status"><Select aria-label="Lead status" onChange={(event) => setStatus(event.target.value)} value={status}><option>All statuses</option>{leadStatuses.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Country"><Select aria-label="Lead country" onChange={(event) => setCountry(event.target.value)} value={country}><option>All countries</option>{allowedCountries.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          {role !== "Sales Team User" ? <Field label="Reseller"><Select aria-label="Lead reseller" onChange={(event) => setReseller(event.target.value)} value={reseller}><option>All resellers</option>{resellers.map((item) => <option key={item}>{item}</option>)}</Select></Field> : null}
          {role !== "Sales Team User" ? <Field label="Assigned user"><Select aria-label="Lead assignee" onChange={(event) => setAssignee(event.target.value)} value={assignee}><option>All users</option>{assignees.map((item) => <option key={item}>{item}</option>)}</Select></Field> : null}
        </CardContent>
      </Card>

      {error ? <Card><CardHeader><CardTitle>Unable to load leads</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card> : null}
      {!error && visible.length === 0 ? <Card><CardHeader><CardTitle>No leads found</CardTitle><CardDescription>Adjust the filters or create a lead through the portal API.</CardDescription></CardHeader></Card> : null}
      {visible.length > 0 ? (
        <section className="grid gap-3" aria-label="Leads">
          {visible.map((lead) => (
            <a className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(110px,0.7fr))]" href={`/leads/${lead.id}`} key={lead.id}>
              <div className="min-w-0"><p className="font-semibold">{lead.company}</p><p className="truncate text-sm text-slate-500 dark:text-slate-400">{lead.contact} · {lead.id}</p></div>
              <div><p className="text-xs text-slate-500">Country</p><p className="text-sm font-medium">{lead.country}</p></div>
              <div><p className="text-xs text-slate-500">Priority</p><p className="text-sm font-medium">{lead.priority}</p></div>
              <div><p className="text-xs text-slate-500">Status</p><p className="text-sm font-medium">{lead.status}</p></div>
              <div><p className="text-xs text-slate-500">Follow-up</p><p className="text-sm font-medium">{lead.followUp}</p></div>
            </a>
          ))}
        </section>
      ) : null}
    </div>
  );
}
