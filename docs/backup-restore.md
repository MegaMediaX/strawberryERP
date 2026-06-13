# Backup and Restore

This guide covers the production data owned by ERPNext/Frappe, MariaDB, files, and external contract storage.

## Backup

### MariaDB

Use Frappe bench backup or a database-native backup strategy:

```bash
bench --site lebtech.local backup --with-files
```

For database-only backups, use your managed MariaDB snapshot tooling or `mysqldump` with credentials from the deployment secret manager.

### ERPNext Files

Back up:

- `sites/lebtech.local/private/files`
- `sites/lebtech.local/public/files`
- `sites/lebtech.local/site_config.json`
- app version metadata and deployment manifests

Private files may include contracts, receipt attachments, imports, exports, and generated PDFs. Treat them as sensitive.

### `.env` and Secrets

Do not store raw production secrets in ordinary file backups unless the backup system is encrypted and access-controlled. Record:

- secret names
- secret owner
- rotation date
- recovery location
- deployment environment using each secret

Do not print `FRAPPE_API_SECRET`, SMTP passwords, Google client secrets, WhatsApp tokens, or Portal API raw keys in logs.

### Google Drive Contract Storage

If contracts are stored in Google Drive, the portal stores metadata and file links, while Google Drive remains the file authority. Back up:

- Google Drive folder ownership and sharing policy
- service account or OAuth app configuration
- contract folder IDs
- exported contract metadata from Frappe

Confirm retention rules with the business owner before deleting any Drive files.

## Restore

### Restore MariaDB and Files

1. Provision the same ERPNext/Frappe major version used by the backup.
2. Restore MariaDB from bench backup, managed snapshot, or SQL dump.
3. Restore `private/files` and `public/files`.
4. Restore `site_config.json` and required app configuration.
5. Reinstall or fetch `lebtech_partner_platform` if the app code is missing.
6. Run migration and cache clear:

```bash
bench --site lebtech.local migrate
bench --site lebtech.local clear-cache
```

### Reconnect Secrets and Integrations

1. Recreate deployment environment variables from the secret manager.
2. Rotate Frappe API credentials if the incident scope is unclear.
3. Reconnect SMTP, WhatsApp, Google Calendar, and Google Drive.
4. Revoke stale Portal API Key records.
5. Confirm integration settings return redacted values, not raw secrets.

### Post-Restore Validation

```bash
npm run smoke
npm run smoke:frappe
```

For the Dockerized bench, the automated operations and restore drills are:

```bash
npm run smoke:frappe:operations
npm run smoke:frappe:restore
```

Export the newest complete database/public/private backup set out of the Docker volume with SHA-256 integrity metadata:

```bash
BACKUP_EXPORT_DIR=/var/backups/lebtech-partner-platform npm run backup:export
```

The command creates a timestamped directory containing one matching database/public/private/site-config backup set and `manifest.json`. Treat the export as sensitive. Transfer it to encrypted off-host storage, verify the hashes after upload, apply the production retention policy, and test retrieval before considering the backup gate closed.

The export also includes `deployment-metadata.json` with application and runtime version references. Encrypt and upload the bundle with either an `rclone` remote for S3-compatible storage, Cloudflare R2, or SFTP, or a filesystem target for validation:

```bash
BACKUP_ENCRYPTION_KEY_FILE=/run/secrets/backup_encryption_key \
OFFHOST_PROVIDER=rclone \
OFFHOST_RCLONE_TARGET=production-backups:lebtech-partner-platform \
npm run backup:offhost
```

The tool encrypts each file with AES-256-GCM using an scrypt-derived key before transport, writes `encrypted-manifest.json`, uploads, and invokes remote checksum verification through `rclone check`. Provider credentials remain in the `rclone` configuration or secret manager and are never hardcoded.

Verify a retrieved bundle without decryption:

```bash
npm run backup:verify -- /secure/retrieved-bundle.encrypted
```

For a restore drill, also verify authentication and the plaintext manifest after temporary decryption:

```bash
BACKUP_VERIFY_DECRYPT=true \
BACKUP_ENCRYPTION_KEY_FILE=/run/secrets/backup_encryption_key \
npm run backup:verify -- /secure/retrieved-bundle.encrypted
```

Schedule daily execution, retain daily backups for 30 days and monthly backups according to business policy, and alert on command failure or a backup age above 36 hours. Keep the encryption key separate from backup storage.

The restore smoke creates a generated `lebtech-restore-*.local` site, restores the newest database/public/private backups, runs migration, validates installed apps and core record counts, and removes the temporary site. Run it only on a bench host where temporary site/database creation is permitted.

Then verify:

- Partner Lead list loads.
- Invoice and receipt records are present.
- Partner Invoice payment status matches receipts.
- Commission Entry records are present and not duplicated.
- Activity Timeline records are present.
- Pending Delete Queue records are present and scoped.
- API keys are hashed and scoped.
- Israel, IL, and ISR remain blocked.
- HTTP DELETE remains blocked.

## Restore Drill Frequency

Run a restore drill at least once before production launch and after major schema changes. Phase 7 completed this drill locally against the pinned production-profile stack. Record:

- backup timestamp
- restore target
- restore duration
- smoke test result
- migration issues
- unresolved data gaps

Record any restore blocker or failed smoke result in `docs/production-blockers.md`.
