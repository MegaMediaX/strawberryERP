"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Inlined to keep this client bundle free of server-only modules.
const CHANNELS = ["Email", "WhatsApp", "Calendar", "In-App"] as const;
type Channel = (typeof CHANNELS)[number];
type ChannelPrefs = Record<Channel, boolean>;

const FALLBACK: ChannelPrefs = { Email: true, WhatsApp: false, Calendar: true, "In-App": true };

export function NotificationPreferencesForm() {
  const [channels, setChannels] = useState<ChannelPrefs>(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/frappe/settings/notification-preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (active && body?.data?.channels) setChannels({ ...FALLBACK, ...body.data.channels });
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  function toggle(channel: Channel) {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
    setSuccess(null);
  }

  async function save() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frappe/settings/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : body.error?.message ?? "Could not save preferences.");
        return;
      }
      setSuccess("Preferences saved.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Your notification channels</CardTitle>
        <CardDescription>Choose how you want to be notified. This applies only to your account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          {CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              disabled={!loaded}
              onClick={() => toggle(channel)}
              aria-pressed={channels[channel]}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--background)] disabled:opacity-60"
            >
              <span>{channel}</span>
              <span
                className={
                  channels[channel]
                    ? "inline-flex h-7 items-center rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-white"
                    : "inline-flex h-7 items-center rounded-full border border-[var(--border)] px-3 text-xs font-semibold text-[var(--muted)]"
                }
              >
                {channels[channel] ? "On" : "Off"}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        <div>
          <button
            onClick={save}
            disabled={busy || !loaded}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
