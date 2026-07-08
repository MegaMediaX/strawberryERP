/** Route-level skeleton for /sales/* while server data loads (spec §3). */
export default function SalesLoading() {
  return (
    <div className="grid gap-5">
      <div className="h-[196px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
    </div>
  );
}
