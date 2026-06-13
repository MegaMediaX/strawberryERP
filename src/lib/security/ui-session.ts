import "server-only";

import { headers } from "next/headers";

import { resolveExplicitPortalSession } from "@/lib/portal-security";

export async function getPortalUiSession() {
  return resolveExplicitPortalSession(await headers());
}
