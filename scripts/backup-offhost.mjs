import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { encryptFile } from "./lib/backup-crypto.mjs";
import { sha256File, verifyEncryptedManifest, verifyPlainManifest } from "./lib/backup-manifest.mjs";

const source = await resolveSourceBundle();
const plainManifest = await verifyPlainManifest(source);
const passphrase = readPassphrase();
const encryptedRoot = resolve(process.env.BACKUP_ENCRYPTED_DIR || `${source}.encrypted`);

if (existsSync(encryptedRoot)) {
  throw new Error(`Encrypted staging directory already exists: ${encryptedRoot}`);
}
mkdirSync(encryptedRoot, { recursive: true });

const plainFiles = ["manifest.json", ...plainManifest.artifacts.map((artifact) => artifact.file)];
const encryptedFiles = [];

for (const plainFile of plainFiles) {
  const encryptedFile = `${plainFile}.lbk`;
  await encryptFile(resolve(source, plainFile), resolve(encryptedRoot, encryptedFile), passphrase);
  encryptedFiles.push({
    plainFile,
    encryptedFile,
    bytes: statSync(resolve(encryptedRoot, encryptedFile)).size,
    sha256: await sha256File(resolve(encryptedRoot, encryptedFile)),
  });
}

const encryptedManifest = {
  formatVersion: 1,
  encryption: "AES-256-GCM+scrypt",
  sourceSite: plainManifest.site,
  sourceExportedAt: plainManifest.exportedAt,
  encryptedAt: new Date().toISOString(),
  files: encryptedFiles,
};
writeFileSync(resolve(encryptedRoot, "encrypted-manifest.json"), `${JSON.stringify(encryptedManifest, null, 2)}\n`);
await verifyEncryptedManifest(encryptedRoot);

const provider = process.env.OFFHOST_PROVIDER;
if (provider === "filesystem") {
  const targetRoot = required("OFFHOST_TARGET");
  const destination = resolve(targetRoot, basename(encryptedRoot));
  if (existsSync(destination)) throw new Error(`Off-host destination already exists: ${destination}`);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(encryptedRoot, destination, { recursive: true, errorOnExist: true });
  await verifyEncryptedManifest(destination);
  console.log(`PASS encrypted backup copied and verified at ${destination}`);
} else if (provider === "rclone") {
  const target = required("OFFHOST_RCLONE_TARGET").replace(/\/$/, "");
  run("rclone", ["copy", encryptedRoot, `${target}/${basename(encryptedRoot)}`]);
  run("rclone", ["check", encryptedRoot, `${target}/${basename(encryptedRoot)}`, "--one-way", "--download"]);
  console.log("PASS encrypted backup uploaded and verified through rclone");
} else {
  throw new Error("OFFHOST_PROVIDER must be filesystem or rclone.");
}

if (process.env.BACKUP_KEEP_ENCRYPTED_LOCAL !== "true") {
  rmSync(encryptedRoot, { recursive: true, force: true });
}

async function resolveSourceBundle() {
  if (process.env.BACKUP_SOURCE_DIR) return resolve(process.env.BACKUP_SOURCE_DIR);
  run(process.execPath, ["scripts/frappe-backup-export.mjs"]);
  const root = resolve(process.env.BACKUP_EXPORT_DIR || "backups");
  const latest = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
  if (!latest) throw new Error("No exported backup directory was created.");
  return latest;
}

function readPassphrase() {
  if (process.env.BACKUP_ENCRYPTION_KEY_FILE) {
    return readFileSync(process.env.BACKUP_ENCRYPTION_KEY_FILE, "utf8").trim();
  }
  return required("BACKUP_ENCRYPTION_KEY");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}
