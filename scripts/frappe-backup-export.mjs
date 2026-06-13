import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const site = process.env.SITE_NAME || "lebtech.local";
const exportRoot = resolve(process.env.BACKUP_EXPORT_DIR || "backups");

if (!/^[A-Za-z0-9.-]+$/.test(site)) {
  throw new Error("SITE_NAME contains unsupported characters.");
}

function compose(args, options = {}) {
  const result = spawnSync("docker", ["compose", ...args], {
    encoding: "utf8",
    env: process.env,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`docker compose ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result.stdout || "";
}

if (process.env.BACKUP_SKIP_CREATE !== "true") {
  compose(["exec", "-T", "backend", "bench", "--site", site, "backup", "--with-files"], { stdio: "inherit" });
}

const backupDirectory = `/home/frappe/frappe-bench/sites/${site}/private/backups`;
const listing = compose([
  "exec",
  "-T",
  "backend",
  "bash",
  "-lc",
  `find '${backupDirectory}' -maxdepth 1 -type f -printf '%T@|%f\\n' | sort -nr`,
]);

const names = listing
  .split(/\r?\n/)
  .map((line) => line.slice(line.indexOf("|") + 1).trim())
  .filter(Boolean);

const suffixes = {
  database: "-database.sql.gz",
  privateFiles: "-private-files.tar",
  publicFiles: "-files.tar",
  siteConfig: "-site_config_backup.json",
};
const sets = new Map();

for (const name of names) {
  const match = Object.entries(suffixes).find(([, suffix]) => name.endsWith(suffix));
  if (!match) continue;
  const [kind, suffix] = match;
  const key = name.slice(0, -suffix.length);
  const set = sets.get(key) || {};
  set[kind] = name;
  sets.set(key, set);
}

const completeSet = [...sets.values()].find((set) => Object.keys(suffixes).every((kind) => set[kind]));
const selected = completeSet ? Object.keys(suffixes).map((kind) => completeSet[kind]) : [];

if (selected.length !== Object.keys(suffixes).length) {
  throw new Error("A matching database/public/private/site-config Frappe backup set was not found.");
}

const exportId = new Date().toISOString().replace(/[:.]/g, "-");
const destination = resolve(exportRoot, `${site}-${exportId}`);
mkdirSync(destination, { recursive: true });

const artifacts = [];
for (const fileName of selected) {
  const safeName = basename(fileName);
  compose(["cp", `backend:${backupDirectory}/${safeName}`, destination]);
  const localPath = resolve(destination, safeName);
  const content = readFileSync(localPath);
  artifacts.push({
    file: safeName,
    bytes: statSync(localPath).size,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const deploymentMetadata = {
  generatedAt: new Date().toISOString(),
  site,
  application: {
    name: packageJson.name,
    version: packageJson.version,
    next: packageJson.dependencies?.next,
    customApp: "lebtech_partner_platform",
  },
  images: {
    erpnext: process.env.ERPNEXT_IMAGE || "frappe/erpnext:v15.111.0",
    mariadb: process.env.MARIADB_IMAGE || "mariadb:10.6.27",
    redis: process.env.REDIS_IMAGE || "redis:7-alpine",
    nginx: process.env.NGINX_IMAGE || "nginx:1.27-alpine",
  },
};
const metadataFile = "deployment-metadata.json";
const metadataPath = resolve(destination, metadataFile);
writeFileSync(metadataPath, `${JSON.stringify(deploymentMetadata, null, 2)}\n`);
const metadataContent = readFileSync(metadataPath);
artifacts.push({
  file: metadataFile,
  bytes: statSync(metadataPath).size,
  sha256: createHash("sha256").update(metadataContent).digest("hex"),
});

const manifest = {
  formatVersion: 1,
  site,
  exportedAt: new Date().toISOString(),
  artifacts,
};

writeFileSync(resolve(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`PASS exported ${artifacts.length} backup artifacts with SHA-256 manifest to ${destination}`);
