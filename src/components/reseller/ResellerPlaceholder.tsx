import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Temporary placeholder for reseller routes under construction (slice 1). */
export function ResellerPlaceholder({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{detail}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">Coming in an upcoming slice.</p>
        </CardContent>
      </Card>
    </div>
  );
}
