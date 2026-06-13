# Operations and Monitoring

## Health Endpoints

- `GET /api/health/live` confirms that the Next.js process can serve requests.
- `GET /api/health/ready` confirms that required Frappe settings exist and an authenticated Frappe request succeeds within five seconds.

Load balancers should use readiness for traffic routing. Process supervisors may use liveness for restart decisions. Neither response includes API keys, secrets, database information, or Frappe error bodies.

## Edge Logging

NGINX writes JSON access records containing timestamp, request ID, client address, method, URI, status, response bytes, request duration, and upstream duration. Forward container logs to the production log platform and retain request IDs through support and incident workflows.

Alert on:

- readiness failures for two consecutive minutes
- repeated backend or frontend container restarts
- scheduler disabled or no Frappe workers online
- sustained HTTP 429, 401, 403, or 5xx increases
- backup export or restore-drill failure
- disk, MariaDB volume, or Frappe sites volume above 80 percent

## Production Preflight

Set `PRODUCTION_ENV_FILE` to the deployment environment file or export the values into the current process:

```bash
PRODUCTION_ENV_FILE=/run/secrets/lebtech-production.env npm run preflight:production
```

The preflight checks required values without printing them, rejects placeholder or short secrets, requires immutable image digests and an HTTPS public URL, validates edge isolation, and can probe a running deployment:

```bash
PREFLIGHT_PROBE_BASE_URL=https://portal.example.com npm run preflight:production
```

## Edge Smoke

After TLS and DNS are active:

```bash
EDGE_BASE_URL=https://portal.example.com npm run smoke:edge
```

This validates liveness, readiness, edge headers, request IDs, hidden NGINX version, the blocked generic Frappe tunnel, and the portal's fixed HTTP DELETE rejection.

## External Gates

Repository validation cannot issue certificates, provision a secret manager, configure an external alert destination, or prove that backup data has left the host. Complete and record those items in the production deployment environment before launch.
