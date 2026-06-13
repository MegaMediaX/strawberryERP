# Ingress and WAF

The canonical origin template is `deploy/nginx/production.conf.example`.

## Origin Controls

- Expose ports 80 and 443 only.
- Keep Frappe, MariaDB, and Redis off the public network.
- Permit portal methods required by Next.js; the application boundary still returns `405` for HTTP DELETE.
- Rate-limit `/api/frappe/*` to 20 requests per second per client with a burst of 40.
- Limit request bodies to 50 MB and upstream timeouts to 120 seconds.
- Add request IDs, JSON logs, HSTS, MIME sniffing protection, framing policy, referrer policy, permissions policy, and secure cookie flags.
- Return `404` for `/erpnext-api/*`, `/app`, `/desk`, `/login`, direct Frappe APIs, Frappe assets, and hidden files.

## Cloudflare or WAF Rules

1. Block direct requests to `/erpnext-api/*`, `/api/method/*`, `/api/resource/*`, `/app*`, `/desk*`, and `/socket.io/*`.
2. Challenge high-confidence automated traffic on authentication and API-key management paths.
3. Apply a per-IP API rate rule compatible with the NGINX origin limit.
4. Block malformed methods and request bodies above the documented limit.
5. Enable managed OWASP rules in log mode first, then block after reviewing false positives.
6. Restrict origin ingress to WAF proxy addresses when proxying is mandatory.
7. Preserve the real client address only from trusted proxy networks; never trust arbitrary forwarded headers.
8. Optionally allowlist corporate/VPN addresses for deployment administration. Do not expose ERPNext Desk as an admin shortcut.

Bot protection must not block health monitors, payment-provider callbacks, Google OAuth redirects, or approved WhatsApp webhooks. Create explicit narrow exceptions by path and source identity.

## Validation

```bash
nginx -t
EDGE_BASE_URL=https://portal.example.com npm run smoke:edge
curl -i -X DELETE https://portal.example.com/api/frappe/invoices
curl -i https://portal.example.com/erpnext-api/api/method/ping
```

Expected results are `405 METHOD_NOT_ALLOWED` and `404`, respectively. Capture WAF event evidence for a blocked-path test before launch.
