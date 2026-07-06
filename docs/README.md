# Documentation Index

A map of the project's docs so contributors can find the right one quickly and
avoid the overlapping "readiness" files drifting out of sync (OPS-13). When in
doubt about production status, start with **[production-blockers.md](production-blockers.md)**
(the live tracker) and **[production-go-no-go.md](production-go-no-go.md)** (the decision).

## Architecture & audits
- [architecture.md](architecture.md) — system architecture overview.
- [architecture-audit-2026-07-04.md](architecture-audit-2026-07-04.md) — full 3-domain architecture audit (27 findings).
- [adr/](adr/) — Architecture Decision Records (e.g. `0002` accepts Next.js-layer authorization / SEC-2).
- [dependency-risk-register.md](dependency-risk-register.md) — tracked dependency risks.

## Production readiness & launch
These five are complementary, not duplicates — each has a distinct role:

| Doc | Role |
|-----|------|
| [production-go-no-go.md](production-go-no-go.md) | The **decision** report (GO / NO-GO) and the decision rule. |
| [production-readiness-plan.md](production-readiness-plan.md) | The **plan** to move from NO-GO to a justified GO. |
| [production-blockers.md](production-blockers.md) | The **live tracker** — a table of every blocker with severity, repro, and fix status. Update this as items close. |
| [launch-candidate-checklist.md](launch-candidate-checklist.md) | A **checklist** completed only with timestamped execution proof. |
| [../PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) | Root-level **summary** derived from `BUILD_STATE.md`; a snapshot, not the source of truth. |

## Deployment & infrastructure
- [production-deployment-checklist.md](production-deployment-checklist.md) — full-stack (Next.js + Frappe) deploy steps.
- [staging-deployment.md](staging-deployment.md) / [staging-runbook.md](staging-runbook.md) — staging stand-up.
- [hostinger-deploy.md](hostinger-deploy.md) — Hostinger-specific deploy notes.
- [domain-tls.md](domain-tls.md) — DNS + TLS provisioning.
- [ingress-waf.md](ingress-waf.md) — edge/WAF policy.

## Operations
- [operations-monitoring.md](operations-monitoring.md) / [monitoring.md](monitoring.md) — health endpoints, probes, alerting.
- [backup-restore.md](backup-restore.md) — backup + disaster-recovery procedures.
- [secret-management.md](secret-management.md) — secret storage, rotation, revocation.
- [live-bench-runbook.md](live-bench-runbook.md) — Dockerized Frappe bench commands.

## Integration & validation
- [openapi.yaml](openapi.yaml) — API contract.
- [frappe-live-validation.md](frappe-live-validation.md) — live Frappe validation procedure.
- [../INTEGRATION_SPEC.md](../INTEGRATION_SPEC.md) — integration specification.

## UI specs & QA audits
- [SUPER_ADMIN_UI_SPEC.md](SUPER_ADMIN_UI_SPEC.md), [REGIONAL_DIRECTOR_UI_SPEC.md](REGIONAL_DIRECTOR_UI_SPEC.md), [RESELLER_ADMIN_UI_SPEC.md](RESELLER_ADMIN_UI_SPEC.md), [SALES_UI_SPEC.md](SALES_UI_SPEC.md) — per-role UI specs.
- [ui-ux-click-path-audit-2026-07-03.md](ui-ux-click-path-audit-2026-07-03.md), [browser-qa-phase9a.md](browser-qa-phase9a.md), [redial-sales-flow-audit-2026-07-04.md](redial-sales-flow-audit-2026-07-04.md), [sales-agent-efficiency-research-2026-07-04.md](sales-agent-efficiency-research-2026-07-04.md) — QA / UX audits & research.

## Root-level docs (repo root, not `docs/`)
- [../README.md](../README.md) — project overview & quickstart.
- [../BUILD_STATE.md](../BUILD_STATE.md) — running build journal (append-only; large — prefer the docs above for specific topics).
- [../CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md) — handoff notes & operational context.
- [../REVIEW.md](../REVIEW.md) — review log.
