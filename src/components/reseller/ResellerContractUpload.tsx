"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileText, Info, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { validateContractUpload } from "@/lib/reseller/contract-upload";

export interface ContractFile {
  id: string;
  fileUrl: string;
  contractStatus: "Not Signed" | "Signed";
  uploadedBy: string;
  uploadedAt: string;
}

const fileName = (url: string) => decodeURIComponent(url.split("/").pop() ?? url);

export function ResellerContractUpload({
  customerId, customerName, country, initialContracts,
}: {
  customerId: string;
  customerName: string;
  country: string;
  initialContracts: ContractFile[];
}) {
  const [contracts, setContracts] = useState(initialContracts);
  const [picked, setPicked] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    setError(null);
    const v = validateContractUpload(picked);
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer: customerName, country, fileName: picked }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Upload failed."); return; }
      setContracts((prev) => [body.data.contract as ContractFile, ...prev]);
      setPicked("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = contracts.some((c) => c.contractStatus === "Signed") ? "Signed" : "Not Signed";

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <Link href={`/reseller/customers/${customerId}`} aria-label="Back to customer" className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Contracts</h1>
          <p className="text-sm text-[var(--muted)]">{customerName} · <Badge tone={status === "Signed" ? "green" : "neutral"}>{status}</Badge></p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
        <Info className="size-4 shrink-0" /> Google Drive storage is connected via hook only — in this environment the file isn&apos;t physically uploaded; we record its name, who uploaded it, and when, and mark the contract signed.
      </div>

      <Card>
        <CardHeader><CardTitle>Upload a contract</CardTitle><CardDescription>PDF, DOC, DOCX, PNG, or JPG.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-6 py-8 text-center hover:bg-[var(--background)]">
            <UploadCloud className="size-7 text-[var(--muted)]" />
            <span className="text-sm font-semibold">{picked || "Choose a file"}</span>
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { setPicked(e.target.files?.[0]?.name ?? ""); setError(null); }} />
          </label>
          {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{error}</p> : null}
          <button onClick={upload} disabled={busy || !picked} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] hover:bg-[var(--brand-hover)] disabled:opacity-50">
            <UploadCloud className="size-4" /> {busy ? "Uploading…" : "Upload contract"}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Uploaded files</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {contracts.length === 0 ? <p className="text-sm text-[var(--muted)]">No contract files yet.</p> : contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold"><FileText className="size-3.5 shrink-0 text-[var(--muted)]" />{c.fileUrl ? fileName(c.fileUrl) : "(template-generated)"}</p>
                <p className="text-xs text-[var(--muted)]">{c.uploadedBy || "—"}{c.uploadedAt ? ` · ${new Date(c.uploadedAt).toLocaleString()}` : ""}</p>
              </div>
              {c.fileUrl ? <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--brand)]">Drive link</a> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
