/** Route-level skeleton for /admin/* while server data loads (spec §5-§8). */
export default function AdminLoading() {
  return (
    <div className="grid gap-5">
      <div className="h-6 w-56 animate-pulse rounded-lg bg-[var(--surface)]" />
      <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
