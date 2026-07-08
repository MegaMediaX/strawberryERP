"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isBlockedPhone } from "@/lib/telephony/call-record";
import { toLocalDialNumber } from "@/lib/telephony/local-dial";
import type { WebrtcConfig } from "@/lib/telephony/webrtc";

/**
 * In-browser softphone (ADR 0001, Option B). Registers to the on-VPS Asterisk
 * gateway over WSS via SIP.js and places the call straight from the rep's
 * browser — no per-desk install, audio in/out of the browser. sip.js is loaded
 * dynamically so it never touches the server render.
 *
 * The gateway dials an analog FXO trunk that needs LOCAL trunk-0 digits, not
 * E.164 — numbers are normalized via toLocalDialNumber before the sip: URI is
 * built (the Asterisk dialplan applies the same rewrite defensively). Country-block (IL)
 * is guarded here for UX, but the AUTHORITATIVE block lives in the Asterisk
 * dialplan (the browser talks to the gateway directly, not through the CRM).
 */

type Phase = "loading" | "unconfigured" | "connecting" | "ready" | "calling" | "in-call" | "error";

// Minimal shape of the sip.js Web.SimpleUser we use (avoids a type dep at build).
interface SimpleUser {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  register(): Promise<void>;
  call(destination: string): Promise<void>;
  hangup(): Promise<void>;
  delegate?: {
    onCallAnswered?: () => void;
    onCallHangup?: () => void;
    onCallCreated?: () => void;
    onRegistered?: () => void;
    onServerDisconnect?: (error?: Error) => void;
  };
}

const btn =
  "inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-transform active:scale-[0.98] disabled:opacity-60";

export function WebrtcCallButton({ number, onCallStarted }: { number: string; onCallStarted?: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const userRef = useRef<SimpleUser | null>(null);
  const domainRef = useRef<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let user: SimpleUser | null = null;

    (async () => {
      try {
        const res = await fetch("/api/telephony/webrtc-config");
        if (res.status === 404) {
          if (!cancelled) setPhase("unconfigured");
          return;
        }
        if (!res.ok) throw new Error(`Config unavailable (${res.status})`);
        const { config } = (await res.json()) as { config: WebrtcConfig };

        if (cancelled) return;
        setPhase("connecting");

        // Dynamic import keeps sip.js out of SSR + the initial bundle.
        const { Web } = await import("sip.js");
        if (cancelled) return;
        user = new Web.SimpleUser(config.wssUrl, {
          aor: config.sipUri,
          media: { remote: { audio: audioRef.current ?? undefined } },
          userAgentOptions: {
            authorizationUsername: config.authUser,
            authorizationPassword: config.password,
            sessionDescriptionHandlerFactoryOptions: {
              peerConnectionConfiguration: { iceServers: config.iceServers },
            },
          },
        }) as unknown as SimpleUser;
        // Track it NOW (before connect) so unmount mid-connect can still tear it
        // down — otherwise a REGISTER completed after unmount would be orphaned.
        userRef.current = user;

        user.delegate = {
          onCallAnswered: () => !cancelled && setPhase("in-call"),
          onCallHangup: () => !cancelled && setPhase("ready"),
          onServerDisconnect: () => {
            if (cancelled) return;
            setPhase("error");
            setMessage("Lost connection to the phone service.");
          },
        };

        await user.connect();
        await user.register();
        if (cancelled) {
          // Unmounted during connect/register — undo the registration we just made.
          void user.disconnect().catch(() => {});
          return;
        }
        domainRef.current = config.sipDomain;
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          setMessage(e instanceof Error ? e.message : "Could not start the softphone.");
        }
      }
    })();

    return () => {
      cancelled = true;
      // Best-effort teardown of whatever was constructed (even mid-connect); ignore
      // rejections on an already-closing transport.
      const u = userRef.current;
      userRef.current = null;
      void u?.hangup().catch(() => {});
      void u?.disconnect().catch(() => {});
    };
  }, []);

  const place = useCallback(async () => {
    const user = userRef.current;
    if (!user) return;
    setMessage(null);
    if (isBlockedPhone(number)) {
      setMessage("Dialing this country is blocked.");
      return;
    }
    const digits = toLocalDialNumber(number); // FXO needs local trunk-0 format, not E.164
    if (!digits) {
      setMessage("This lead has no dialable number.");
      return;
    }
    try {
      setPhase("calling");
      await user.call(`sip:${digits}@${domainRef.current}`);
      // Only mark the call logged once it was actually placed (not if call() threw).
      onCallStarted?.();
    } catch (e) {
      setPhase("ready");
      setMessage(e instanceof Error ? e.message : "Could not place the call.");
    }
  }, [number, onCallStarted]);

  const hangup = useCallback(async () => {
    try {
      await userRef.current?.hangup();
    } finally {
      setPhase("ready");
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-1">
      <audio ref={audioRef} autoPlay />
      {phase === "in-call" || phase === "calling" ? (
        <button type="button" onClick={hangup} className={`${btn} bg-rose-600 hover:bg-rose-700`}>
          {phase === "calling" ? "Ringing… tap to cancel" : "End call"}
        </button>
      ) : (
        <button
          type="button"
          onClick={place}
          disabled={phase !== "ready"}
          className={`${btn} bg-indigo-600 hover:bg-indigo-700`}
        >
          {phase === "ready"
            ? "Call via browser"
            : phase === "connecting" || phase === "loading"
              ? "Connecting…"
              : phase === "unconfigured"
                ? "Phone not set up"
                : "Phone unavailable"}
        </button>
      )}
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
