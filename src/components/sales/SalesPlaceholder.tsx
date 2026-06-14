import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Temporary placeholder for sales routes still under construction (slice 1). */
export function SalesPlaceholder({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--muted)]">Coming in an upcoming slice.</p>
      </CardContent>
    </Card>
  );
}
