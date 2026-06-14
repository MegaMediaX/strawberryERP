"use client";

import { useState } from "react";
import QRCode from "qrcode";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Enrollment = { secret: string; otpauthUrl: string };

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-ring)]";
const btnClass =
  "rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60";

export default function SecurityPage() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: unknown) {
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; data?: unknown; error?: { message: string } };
    if (!res.ok || !json.ok) {
      throw new Error(json.error?.message ?? "Request failed.");
    }
    return json.data;
  }

  async function startSetup() {
    setBusy(true);
    setStatus(null);
    try {
      const data = (await call("/api/auth/2fa/setup")) as Enrollment;
      setEnrollment(data);
      try {
        setQrDataUrl(await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 200 }));
      } catch {
        setQrDataUrl(null); // fall back to manual key entry
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    try {
      await call("/api/auth/2fa/activate", { code });
      setStatus("Two-factor authentication is now enabled.");
      setEnrollment(null);
      setQrDataUrl(null);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await call("/api/auth/2fa/disable");
      setStatus("Two-factor authentication is disabled.");
      setEnrollment(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-slate-950 dark:text-slate-50">
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Protect your account with an authenticator app (Google Authenticator, Authy, 1Password, …).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enrollment ? (
            <div className="space-y-3">
              <button className={btnClass} onClick={startSetup} disabled={busy}>
                {busy ? "Working…" : "Enable 2FA"}
              </button>
              <button className={`${btnClass} bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300`} onClick={disable} disabled={busy}>
                Disable 2FA
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">1. Add this key to your authenticator app</p>
                <p className="text-slate-600 dark:text-slate-300">
                  Scan this QR code with your authenticator app, or enter the key manually:
                </p>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="2FA QR code"
                    width={200}
                    height={200}
                    className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700"
                  />
                ) : null}
                <code className="block break-all rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
                  {enrollment.secret}
                </code>
                <code className="block break-all rounded-md bg-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800">
                  {enrollment.otpauthUrl}
                </code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">2. Enter the 6-digit code to confirm</p>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
                <button className={btnClass} onClick={activate} disabled={busy || code.length < 6}>
                  {busy ? "Verifying…" : "Verify & enable"}
                </button>
              </div>
            </div>
          )}

          {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
