import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

import { decryptFile } from "./lib/backup-crypto.mjs";
import { verifyEncryptedManifest, verifyPlainManifest } from "./lib/backup-manifest.mjs";

const bundle = resolve(process.argv[2] || process.env.BACKUP_BUNDLE_DIR || "");
if (!bundle) {
  throw new Error("Provide a backup bundle path or BACKUP_BUNDLE_DIR.");
}

const encrypted = await tryEncrypted(bundle);
if (!encrypted) {
  const manifest = await verifyPlainManifest(bundle);
  console.log(`PASS verified ${manifest.artifacts.length} plaintext backup artifacts`);
}

async function tryEncrypted(directory) {
  let manifest;
  try {
    manifest = await verifyEncryptedManifest(directory);
  } catch (error) {
    if (error instanceof Error && error.message === "encrypted-manifest.json was not found.") return false;
    throw error;
  }

  if (process.env.BACKUP_VERIFY_DECRYPT === "true") {
    const passphrase = readPassphrase();
    const temporary = mkdtempSync(resolve(tmpdir(), "lebtech-backup-verify-"));
    try {
      for (const file of manifest.files) {
        await decryptFile(resolve(directory, file.encryptedFile), resolve(temporary, basename(file.plainFile)), passphrase);
      }
      const plainManifest = await verifyPlainManifest(temporary);
      console.log(`PASS decrypted and verified ${plainManifest.artifacts.length} backup artifacts`);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }

  console.log(`PASS verified ${manifest.files.length} encrypted backup files`);
  return true;
}

function readPassphrase() {
  const file = process.env.BACKUP_ENCRYPTION_KEY_FILE;
  if (file) return readFileSync(file, "utf8").trim();
  return process.env.BACKUP_ENCRYPTION_KEY || "";
}
