import { spawnSync } from "node:child_process";

const sourceSite = process.env.SITE_NAME || "lebtech.local";
const restoreSite = `lebtech-restore-${Date.now()}.local`;

const script = String.raw`
set -euo pipefail
source_site="$SOURCE_SITE"
restore_site="$RESTORE_SITE"
backup_dir="sites/$source_site/private/backups"
database_backup="$(find "$backup_dir" -maxdepth 1 -type f -name '*-database.sql.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
public_backup="$(find "$backup_dir" -maxdepth 1 -type f -name '*-files.tar' ! -name '*-private-files.tar' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
private_backup="$(find "$backup_dir" -maxdepth 1 -type f -name '*-private-files.tar' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"

test -n "$database_backup"
test -n "$public_backup"
test -n "$private_backup"

cleanup() {
  bench drop-site "$restore_site" --force --db-root-password "$MARIADB_ROOT_PASSWORD" >/dev/null 2>&1 || true
  python - "$restore_site" <<'PY'
import pathlib
import shutil
import sys

site = sys.argv[1]
if not site.startswith("lebtech-restore-") or not site.endswith(".local"):
    raise SystemExit(f"Refusing to remove unexpected restore path: {site}")
path = pathlib.Path("sites") / site
if path.exists():
    shutil.rmtree(path)
PY
}
trap cleanup EXIT

admin_password="$(python -c 'import secrets; print(secrets.token_hex(24))')"
bench new-site "$restore_site" \
  --db-root-password "$MARIADB_ROOT_PASSWORD" \
  --admin-password "$admin_password" \
  --mariadb-user-host-login-scope='%'

python - "$source_site" "$restore_site" <<'PY'
import json
import pathlib
import sys

source = pathlib.Path("sites") / sys.argv[1] / "site_config.json"
target = pathlib.Path("sites") / sys.argv[2] / "site_config.json"
source_config = json.loads(source.read_text())
target_config = json.loads(target.read_text())
if source_config.get("encryption_key"):
    target_config["encryption_key"] = source_config["encryption_key"]
target.write_text(json.dumps(target_config, indent=1) + "\n")
PY

bench --site "$restore_site" restore "$database_backup" \
  --with-public-files "$public_backup" \
  --with-private-files "$private_backup" \
  --db-root-password "$MARIADB_ROOT_PASSWORD" \
  --force
bench --site "$restore_site" migrate --skip-search-index
bench --site "$restore_site" clear-cache
bench --site "$restore_site" list-apps | grep -q 'lebtech_partner_platform'
summary="$(bench --site "$restore_site" execute lebtech_partner_platform.validation.operations.restore_probe_summary)"
printf '%s\n' "$summary"
printf '%s' "$summary" | grep -q 'Partner Lead'
printf '%s' "$summary" | grep -q 'Activity Timeline'
`;

const result = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "-e",
    `SOURCE_SITE=${sourceSite}`,
    "-e",
    `RESTORE_SITE=${restoreSite}`,
    "backend",
    "bash",
    "-lc",
    script,
  ],
  { encoding: "utf8", env: process.env },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Unable to run restore drill: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error("Live Frappe restore drill failed.");
  process.exit(result.status || 1);
}

console.log("PASS live Frappe restore drill and temporary-site cleanup");
