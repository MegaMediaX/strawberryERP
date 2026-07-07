import crypto from "node:crypto";

/**
 * WebRTC softphone config (server side). Assembles what a rep's browser needs to
 * register to the on-VPS Asterisk gateway over WSS and place calls (ADR 0001,
 * Option B). Secrets (the TURN static-auth secret + per-rep SIP passwords) live
 * ONLY in env on the server; this module hands the browser short-lived TURN
 * credentials + its own SIP seat, never the shared secret.
 */

export interface AgentSeat {
  /** SIP auth username on the gateway, e.g. "agent1". */
  user: string;
  /** SIP auth password for that seat. */
  password: string;
}

export interface TurnCredential {
  username: string;
  credential: string;
}

export interface WebrtcConfig {
  wssUrl: string;
  /** sip:<seat>@<domain> — the AOR the browser registers as. */
  sipUri: string;
  authUser: string;
  password: string;
  sipDomain: string;
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
}

export interface WebrtcEnv {
  wssUrl?: string;
  sipDomain?: string;
  turnUrl?: string;
  turnSecret?: string;
  /** JSON: { "<portalUserId>": { "user": "agent1", "password": "…" } }. */
  agentsJson?: string;
}

/**
 * TURN REST ephemeral credential for coturn's `use-auth-secret` mode:
 *   username   = <unix-expiry>
 *   credential = base64( HMAC-SHA1( static-auth-secret, username ) )
 * The browser can use these to relay media without ever seeing the shared secret.
 */
export function mintTurnCredential(secret: string, ttlSeconds: number, nowSeconds: number): TurnCredential {
  const username = String(Math.floor(nowSeconds) + Math.floor(ttlSeconds));
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential };
}

/** Parse the WEBRTC_AGENTS env map, ignoring malformed entries. */
export function parseAgentMap(json: string | undefined): Record<string, AgentSeat> {
  if (!json) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, AgentSeat> = {};
  for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const seat = v as Record<string, unknown>;
      if (typeof seat.user === "string" && seat.user && typeof seat.password === "string" && seat.password) {
        out[id] = { user: seat.user, password: seat.password };
      }
    }
  }
  return out;
}

/**
 * Build the per-user softphone config, or null when WebRTC isn't configured / the
 * user has no assigned seat. TURN creds are minted fresh each call (short TTL).
 */
export function buildWebrtcConfig(
  env: WebrtcEnv,
  userId: string,
  nowSeconds: number,
  ttlSeconds = 3600,
): WebrtcConfig | null {
  if (!env.wssUrl || !env.sipDomain) return null;
  const seat = parseAgentMap(env.agentsJson)[userId];
  if (!seat) return null;

  const iceServers: WebrtcConfig["iceServers"] = [];
  if (env.turnUrl && env.turnSecret) {
    const { username, credential } = mintTurnCredential(env.turnSecret, ttlSeconds, nowSeconds);
    iceServers.push({ urls: env.turnUrl, username, credential });
  }

  return {
    wssUrl: env.wssUrl,
    sipUri: `sip:${seat.user}@${env.sipDomain}`,
    authUser: seat.user,
    password: seat.password,
    sipDomain: env.sipDomain,
    iceServers,
  };
}

/** Read the WebRTC env once (server only). */
export function webrtcEnv(): WebrtcEnv {
  return {
    wssUrl: process.env.WEBRTC_WSS_URL,
    sipDomain: process.env.WEBRTC_SIP_DOMAIN,
    turnUrl: process.env.WEBRTC_TURN_URL,
    turnSecret: process.env.WEBRTC_TURN_SECRET,
    agentsJson: process.env.WEBRTC_AGENTS,
  };
}

/** Whether the platform is running in browser/WebRTC dialing mode. */
export function isWebrtcMode(): boolean {
  return process.env.TELEPHONY_MODE === "webrtc";
}
