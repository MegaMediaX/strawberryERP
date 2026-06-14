"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NewLeadForm } from "@/components/platform/NewLeadForm";

/**
 * Reseller add-lead (spec §9). Reuses the shared NewLeadForm, constraining the
 * Country dropdown to the reseller's assigned countries and the Assigned-user
 * dropdown to the reseller team (no free-text, no cross-reseller assignment).
 */
export function ResellerNewLead({
  countries,
  assignees,
}: {
  countries: readonly string[];
  assignees: readonly { name: string }[];
}) {
  const router = useRouter();
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Link href="/reseller/leads" aria-label="Back to leads" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Add lead</h1>
      </div>
      <NewLeadForm
        countries={countries}
        assignees={assignees}
        onCreated={() => router.push("/reseller/leads")}
      />
    </div>
  );
}
