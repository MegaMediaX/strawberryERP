import type { NotificationChannel } from "@/lib/phase2-data";

/**
 * Per-user notification preferences (Phase 2 slice 5A) — HOOKS ONLY. A user
 * opts in/out of channels for themselves; the engine/senders (hooks) would
 * consult this before dispatching. Pure logic so it is unit-testable in the
 * node/vitest harness. The API boundary enforces "edit your own only".
 */

export const notificationChannels: readonly NotificationChannel[] = ["Email", "WhatsApp", "Calendar", "In-App"];

export type ChannelPreferences = Record<NotificationChannel, boolean>;

export interface UserNotificationPreference {
  userId: string;
  channels: ChannelPreferences;
}

/** Sensible default: everything on except the heavier WhatsApp channel. */
export const defaultChannelPreferences: ChannelPreferences = {
  Email: true,
  WhatsApp: false,
  Calendar: true,
  "In-App": true,
};

/** Fill any missing channel with the default, ignoring unknown keys. */
export function mergePreferencesWithDefaults(partial?: Partial<ChannelPreferences>): ChannelPreferences {
  const merged = { ...defaultChannelPreferences };
  if (partial) {
    for (const channel of notificationChannels) {
      if (typeof partial[channel] === "boolean") {
        merged[channel] = partial[channel] as boolean;
      }
    }
  }
  return merged;
}

/** Returns an error for an invalid preference payload, or null when valid. */
export function validateUserNotificationPreferences(
  pref: Partial<UserNotificationPreference>,
): string | null {
  if (!pref.userId || !pref.userId.trim()) {
    return "A user id is required.";
  }
  if (pref.channels === undefined || pref.channels === null || typeof pref.channels !== "object") {
    return "Channel preferences are required.";
  }
  for (const [key, value] of Object.entries(pref.channels)) {
    if (!(notificationChannels as readonly string[]).includes(key)) {
      return `Unsupported channel: ${key}.`;
    }
    if (typeof value !== "boolean") {
      return `Channel "${key}" must be on or off.`;
    }
  }
  return null;
}
