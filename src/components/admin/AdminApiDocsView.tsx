import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_ENDPOINTS } from "@/lib/admin/api-center";

function methodTone(m: string): "green" | "blue" | "amber" {
  if (m === "GET") return "green";
  if (m === "POST") return "blue";
  return "amber";
}

/** §23 OpenAPI-style documentation. Static, hooks-only — no live calls. */
export function AdminApiDocsView() {
  return (
    <div className="grid gap-5">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Getting started</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p><span className="font-semibold">Base URL:</span> <code className="font-mono text-xs">https://partner.lebtech.example/api/frappe</code></p>
          <p><span className="font-semibold">Auth:</span> send your key as <code className="font-mono text-xs">Authorization: Bearer ltp_live_…</code></p>
          <p className="text-[var(--muted)]">Scopes are enforced per request. A key only reaches the modules + verbs you granted it.</p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Delete operations are not available through the API.</p>
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Endpoints</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto pt-1">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Method", "Path", "Scope", "Description"].map((h) => <th key={h} className="py-3 pr-4 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {API_ENDPOINTS.map((e) => (
                <tr key={`${e.method}-${e.path}`} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-middle"><Badge tone={methodTone(e.method)}>{e.method}</Badge></td>
                  <td className="py-3 pr-4 align-middle"><code className="font-mono text-xs">{e.path}</code></td>
                  <td className="py-3 pr-4 align-middle"><code className="font-mono text-xs text-[var(--muted)]">{e.scope}</code></td>
                  <td className="py-3 pr-4 align-middle text-[var(--muted)]">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Example request</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-[var(--background)] p-3 font-mono text-xs leading-relaxed">{`curl https://partner.lebtech.example/api/frappe/leads \\
  -H "Authorization: Bearer ltp_live_xxx" \\
  -H "Content-Type: application/json"

# 200 OK
{ "data": [ { "id": "LEAD-2408", "company": "ACME", "status": "Interested" } ],
  "page": 1, "pageSize": 50, "total": 420 }`}</pre>
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Error codes</CardTitle></CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          {[["400", "Validation error — check your payload."], ["401", "Missing or invalid API key."], ["403", "Key lacks the required scope (or DELETE was attempted)."], ["404", "Resource not found."], ["429", "Rate limit exceeded."]].map(([code, msg]) => (
            <p key={code}><code className="font-mono text-xs font-semibold">{code}</code> <span className="text-[var(--muted)]">{msg}</span></p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
