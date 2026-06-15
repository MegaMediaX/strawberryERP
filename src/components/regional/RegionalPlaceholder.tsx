import { Card, CardContent } from "@/components/ui/card";

/** Temporary placeholder for /regional routes not yet built (replaced per slice). */
export function RegionalPlaceholder({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="grid gap-2 pt-5">
          <p className="text-sm text-[var(--muted)]">{detail}</p>
          <p className="text-sm text-[var(--muted)]">Coming in an upcoming slice.</p>
        </CardContent>
      </Card>
    </div>
  );
}
