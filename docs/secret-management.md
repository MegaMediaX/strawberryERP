# Secret Management

Production must not depend on a committed `.env` file. `.env.production.example` contains names and mounted-file paths only.

## Supported Injection Models

- Docker secrets: mount one value per file under `/run/secrets`; set the corresponding `NAME_FILE` variable.
- Host injection: export values from a protected service unit or deployment runner immediately before `docker compose up`.
- Cloud secret manager: resolve secrets through the host workload identity and inject them as environment variables or files.
- Vault or 1Password: use a short-lived operator session or service account to render protected files outside the repository.

The Next.js runtime resolves direct `NAME` values first, then `NAME_FILE`. Secret values are never returned by health or preflight commands.

## Required Secrets

- `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`
- `PORTAL_SESSION_SECRET`, `PORTAL_API_KEY_SECRET`, `API_KEY_HASH_SECRET`
- `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`
- `SMTP_PASSWORD`
- `META_WHATSAPP_ACCESS_TOKEN` or `WASENDER_API_KEY`
- `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_DRIVE_CLIENT_SECRET`
- `BACKUP_ENCRYPTION_KEY`

Infrastructure providers may call `MARIADB_PASSWORD` `DATABASE_PASSWORD`. Map that provider secret to `MARIADB_PASSWORD` or `MARIADB_PASSWORD_FILE` at deployment; do not maintain two independent database passwords.

Use at least 32 random characters for platform and backup keys. Restrict mounted files to the service account and mode `0400` or `0440`.

## Validation

```bash
PRODUCTION_ENV_FILE=/secure/lebtech-production.env npm run preflight:production
```

The command checks presence, minimum length, placeholders, image digests, Compose validity, environment-file tracking, health endpoints, blocked Frappe access, DELETE rejection, and optional backup manifests. It prints names and pass/fail status only.

## Rotation

1. Create a new value in the secret manager.
2. For Frappe API credentials, create a replacement integration credential before revoking the old one.
3. Deploy the new value and confirm readiness and live smoke.
4. Revoke the previous credential.
5. Record owner, rotation date, affected services, and validation evidence.

Rotating `PORTAL_SESSION_SECRET` invalidates active portal sessions. Rotating `API_KEY_HASH_SECRET` requires a planned API-key migration or reissue because existing hashes cannot be reconstructed.

## Emergency Revocation

1. Revoke the affected provider credential immediately.
2. Disable related integration or Portal API Key records.
3. Rotate portal sessions when account compromise is possible.
4. Inspect NGINX request IDs, Portal API Logs, and Activity Timeline events.
5. Deploy replacement secrets and run edge/live smoke.
6. Document scope, timeline, containment, and follow-up actions.

Never print secrets, pass them in command arguments visible to other users, copy them into Docker images, or place them under the repository directory.
