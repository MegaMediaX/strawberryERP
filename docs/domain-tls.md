# Domain and TLS

## DNS

Create `A` records for `portal.example.com` and `api.example.com` pointing to the production IPv4 address. Create `AAAA` records only when the host and firewall are verified for IPv6. Use a 300-second TTL during launch, then raise it after stabilization.

The public host exposes only ports 80 and 443. Frappe remains internal; its optional host port is bound to `127.0.0.1`.

## Reverse Proxy

Use `deploy/nginx/production.conf.example` and copy `deploy/nginx/lebtech-proxy.conf.example` to `/etc/nginx/snippets/lebtech-proxy.conf`. Replace example domains and certificate paths before activation.

- `portal.example.com/*` routes to the custom frontend.
- `api.example.com/api/frappe/*` routes to the same custom API boundary.
- `api.example.com/api/health*` exposes health checks.
- `/erpnext-api/*`, ERPNext Desk, direct Frappe API paths, hidden files, and unmatched API-host paths return `404`.

## Certificate Issuance

With Certbot and the webroot challenge:

```bash
certbot certonly --webroot -w /var/www/certbot -d portal.example.com -d api.example.com
nginx -t
systemctl reload nginx
```

Use the platform certificate manager instead when TLS terminates at a cloud load balancer or Cloudflare. Never commit private keys or certificates.

## Renewal

Enable the provider renewal timer and test it before launch:

```bash
certbot renew --dry-run
systemctl list-timers | grep certbot
```

Monitor certificate expiry and alert below 21 days. Reload NGINX after successful renewal.

## TLS Policy

- Redirect HTTP to HTTPS.
- Allow TLS 1.2 and TLS 1.3 only.
- Enable HSTS after both hostnames are confirmed over HTTPS. The template uses one year with subdomains but does not use `preload`.
- Mark upstream cookies `Secure`, `HttpOnly`, and `SameSite=Lax`.
- Preserve WebSocket upgrade headers for future realtime features.
- Keep `client_max_body_size` at 50 MB and proxy timeouts at 120 seconds unless product limits are reduced.
- Expose `/api/health`, `/api/health/live`, and `/api/health/ready`; do not include secrets or database details in their responses.

## Verification

```bash
curl -I http://portal.example.com
curl -I https://portal.example.com/api/health/ready
EDGE_BASE_URL=https://portal.example.com npm run smoke:edge
MONITOR_BASE_URL=https://portal.example.com npm run monitor:probe
```

Record DNS answers, certificate issuer/expiry, redirect response, HSTS header, and smoke output as launch evidence.
