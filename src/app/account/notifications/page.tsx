import { NotificationPreferencesForm } from "@/components/platform/NotificationPreferencesForm";

export default function NotificationPreferencesPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-slate-950 dark:text-slate-50">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Notifications</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">Manage the channels you receive notifications on.</p>
      <NotificationPreferencesForm />
    </main>
  );
}
