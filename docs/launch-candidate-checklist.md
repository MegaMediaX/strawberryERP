# Launch Candidate Checklist

Mark an item complete only with timestamped execution proof from staging or production.

## Infrastructure

- [ ] Production DNS resolves from external networks.
- [ ] Valid TLS certificates and renewal are configured.
- [ ] HTTP redirects to HTTPS and HSTS is present.
- [ ] WAF rules are active and blocked-path events are verified.
- [ ] Docker stack is healthy.
- [ ] Frappe and MariaDB are healthy.
- [ ] All Redis services are healthy.
- [ ] Two or more workers and the scheduler are healthy.

## Security

- [ ] Secrets are injected from the managed store and preflight passes.
- [ ] Staging/local API credentials are revoked and production credentials are rotated.
- [ ] HTTP DELETE and delete scopes remain unavailable.
- [ ] `/erpnext-api/*` and ERPNext Desk paths are blocked externally.
- [ ] Admin/session routes reject API keys.
- [ ] Live permission matrix passes.
- [ ] Activity Timeline, Portal API Logs, and NGINX request IDs are working.

## Data

- [ ] Production migration passes.
- [ ] Complete backup creation passes.
- [ ] Restore drill passes.
- [ ] Encrypted off-host upload and post-upload checksum verification pass.
- [ ] Retention and deletion policies are active.

## Operations

- [ ] External uptime monitors are active.
- [ ] Host/container metrics are active.
- [ ] Email and critical WhatsApp alerts are delivered successfully.
- [ ] Backup failure and readiness failure alerts are tested.
- [ ] DNS/TLS, secrets, backup, monitoring, ingress, staging, restore, and rollback runbooks are approved.
- [ ] On-call owner and escalation contacts are recorded outside the repository.

## Go/No-Go

**GO** requires every P0/P1 blocker closed with evidence, all checklist items complete, no high/critical dependency findings, and approval from platform, security, and business owners.

**NO-GO** applies when DNS/TLS, managed secrets, off-host recovery, alert delivery, WAF enforcement, migration, permission validation, or restore verification lacks production/staging proof.
