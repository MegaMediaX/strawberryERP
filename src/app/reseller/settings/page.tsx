import Link from "next/link";
import { ChevronRight, MessageSquareText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function ResellerSettingsPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--muted)]">Reseller settings allowed by your Super Admin (§25).</p>
      </div>
      <Card>
        <CardContent className="divide-y divide-[var(--border)] p-0">
          <Link href="/reseller/settings/important-details" className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--background)]">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--background)] text-[var(--brand)]"><MessageSquareText className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Important details</span>
              <span className="block text-xs text-[var(--muted)]">Guidance your sales team sees on the call screen</span>
            </span>
            <ChevronRight className="size-4 text-[var(--muted)]" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
