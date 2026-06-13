# Staging Launch Runbook

1. Provision a Linux Docker host matching production capacity and firewall policy.
2. Create staging DNS records and issue valid TLS certificates.
3. Install the production NGINX template with staging hostnames.
4. Inject staging-only secrets through mounted files or the selected secret manager.
5. Pull/build immutable images and start the stack.
6. Install/migrate `lebtech_partner_platform` and enable the scheduler.
7. Run production preflight with the staging HTTPS URL.
8. Run edge, live Frappe, permission, operations, and restore smoke suites.
9. Run `npm run backup:offhost` to a staging bucket/path and retrieve/verify the encrypted bundle.
10. Connect uptime and host monitoring; deliberately stop a non-production service and confirm alert delivery.
11. Validate WAF blocked paths and review event logs for false positives.
12. Complete `docs/launch-candidate-checklist.md` with links or timestamps for every evidence item.

Required commands:

```bash
docker compose config --quiet
docker compose build
docker compose up -d
PRODUCTION_ENV_FILE=/secure/staging.env PREFLIGHT_PROBE_BASE_URL=https://staging.example.com npm run preflight:production
EDGE_BASE_URL=https://staging.example.com npm run smoke:edge
PLATFORM_BASE_URL=https://staging.example.com npm run smoke:frappe
npm run smoke:frappe:permissions
npm run smoke:frappe:operations
npm run smoke:frappe:restore
npm run backup:offhost
MONITOR_BASE_URL=https://staging.example.com npm run monitor:probe
```

Rollback by restoring the previous immutable image references and application revision, running the compatible migration path, and restoring the pre-deployment backup only when schema/data rollback requires it. Never run destructive database rollback without a verified backup and explicit incident owner.
