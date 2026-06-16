"use client";

import { useState } from "react";

/** §12 — exit impersonation: clears the cookie + audits, then returns to /admin. */
export function ExitImpersonationButton() {
  const [busy, setBusy] = useState(false);
  async function exit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = (await res.json()) as { data?: { redirect?: string } };
      window.location.href = data.data?.redirect ?? "/admin/resellers";
    } catch { setBusy(false); }
  }
  return (
    <button type="button" onClick={exit} disabled={busy} className="inline-flex h-7 items-center rounded-lg bg-amber-950 px-3 text-xs font-bold text-amber-50 hover:bg-amber-900 disabled:opacity-60">
      {busy ? "Exiting…" : "Exit impersonation"}
    </button>
  );
}
