# ADR 0002 — Portal authorization is enforced in the Next.js layer, not per-user in Frappe

- **Status:** Accepted (2026-07-05)
- **Context finding:** Architecture audit 2026-07-04, finding **SEC-2** (`docs/architecture-audit-2026-07-04.md`)
- **Related:** [[naming-branches-prs]] is unrelated; see CLAUDE_HANDOFF §17/§18 (fail-closed identity) and `src/lib/security/permissions.ts`, `src/lib/portal-security.ts`.

## Context

Every request from the Next.js portal to the Frappe/ERPNext backend is made with a **single shared privileged service identity** (`FRAPPE_API_KEY`/`FRAPPE_API_SECRET`). Frappe's own per-user permission hooks therefore always evaluate the same service account and provide **no independent, per-end-user enforcement**. The audit (SEC-2) correctly observed that, as a consequence, **100% of tenant isolation and role/scope enforcement lives in the Next.js layer**.

This was raised as a critical structural finding because a defense-in-depth reading expects the datastore to independently re-check the acting user's permissions. Two ways to resolve it:

- **(a) Forward per-user identity to Frappe** — thread the acting user through every Next.js→Frappe call and rely on Frappe's per-user permission model as a second enforcement layer. This is a large, cross-cutting re-architecture touching the shared backend client and effectively every call site, plus a Frappe-side user-provisioning/token model that does not exist today.
- **(b) Accept the single-layer model and document it** — treat the Next.js layer as the authoritative, sole enforcement boundary, and make that an explicit, guard-railed decision rather than an accident.

## Decision

We adopt **(b)**: portal authorization is deliberately enforced in the Next.js layer, which is the single authoritative boundary. The shared Frappe service identity stays. We are **not** forwarding per-user identity to Frappe at this time.

This is a conscious trade-off, not an oversight. It is acceptable **only because** the Next.js enforcement layer is comprehensive and independently tested:

- Fail-closed identity resolution: unauthenticated/anonymous requests resolve to a least-privilege inactive user, never a privileged default (hardened further by SEC-1 and SEC-3 on 2026-07-05).
- Central request-level authorization in `src/lib/security/permissions.ts` (role/scope, read/write split, sensitive-action gating, API-key scoping) with a large invariant test suite (no-DELETE, no-delete-scope, admin-route key rejection, scope mapping, impersonation no-escalation, country block, etc.).
- Fail-loud writes when the backend is unconfigured (the `writeRequiresBackend()` 501 guard), so misconfiguration cannot silently degrade to an unenforced path.

## Guardrails (conditions that keep this decision safe)

1. **No route may reach Frappe without first passing the Next.js permission check.** New API routes MUST go through the central authorization path; a route that calls the backend client without an authorization decision is a defect.
2. **The shared Frappe credentials are never exposed to the browser or to portal users** and are treated as top-tier secrets (already enforced via `instrumentation.ts` startup checks and `_FILE`/secret-management conventions).
3. **The Next.js enforcement invariants stay green in CI.** The security invariant tests are the compensating control; they must not be weakened.
4. **Direct Frappe access (Desk, bench, other apps against the same site) is an operational trust boundary**, not something the portal defends against — it is restricted to trusted operators.

## Consequences

- **Positive:** No large re-architecture now; the enforcement model is simple, centralized, testable, and already proven. Effort is redirected to hardening the one layer that matters.
- **Negative / accepted risk:** No datastore-level defense in depth. A bug in the Next.js authorization layer is not backstopped by Frappe. This raises the importance of the invariant test suite and of guardrail #1.
- **Revisit if:** the platform gains a second consumer of the Frappe backend (a mobile app, third-party API, or another service) that cannot be trusted to enforce authorization itself, or if a multi-tenant compliance requirement mandates datastore-level per-user enforcement. At that point re-open option (a).
