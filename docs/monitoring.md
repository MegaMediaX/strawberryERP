# Monitoring and Alerts

## Endpoints

- `/api/health`: aggregate frontend and authenticated Frappe status.
- `/api/health/live`: Next.js process liveness.
- `/api/health/ready`: authenticated Frappe readiness.

Use an external HTTPS uptime monitor for all three. Alert after two consecutive readiness failures and verify SSL expiry from outside the host.

## Host Probe

Run on the Docker host:

```bash
COMPOSE_PROJECT_NAME=strawberryerp-prod MONITOR_BASE_URL=https://portal.example.com npm run monitor:probe
```

The JSON result covers frontend/Frappe HTTP status, blocked external Frappe access, all Compose services, MariaDB/Redis health through container state, workers, scheduler, queue depth, failed jobs, backup freshness, site-volume disk usage, and TLS expiry.

Recommended defaults:

| Signal | Warning | Critical |
| --- | --- | --- |
| HTTP availability | 1 failed probe | 2 consecutive failures |
| Error rate | 2% over 5 minutes | 5% over 5 minutes |
| HTTP 429 | sustained increase | 10x baseline |
| Permission errors | 3x baseline | correlated multi-account spike |
| Queue depth | 50 | 100 for 5 minutes |
| Failed jobs | any new failure | repeated same job |
| Backup age | 24 hours | 36 hours |
| Disk usage | 75% | 85% |
| CPU | 80% for 10 minutes | 95% for 5 minutes |
| RAM | 80% | 90% |
| TLS expiry | 30 days | 21 days |

## Alert Delivery

- Email: primary operations and security distribution lists.
- WhatsApp: critical availability and backup failures only; avoid alert loops through the application under test.
- External uptime monitor: HTTPS probes from at least two regions.
- Server metrics agent: CPU, RAM, disk, container restarts, network, and process state.

Forward NGINX JSON logs and Docker logs to centralized storage. Preserve `X-Request-ID` through support and incident workflows. Alert on 5xx rates, rate-limit events, suspicious 401/403 bursts, repeated blocked-path access, container restarts, scheduler/worker failures, stale backups, and disk pressure.

Provider configuration and a successfully delivered test alert are required before the monitoring blocker is closed.
