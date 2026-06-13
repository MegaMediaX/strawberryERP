import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function sha256File(file) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

export async function verifyPlainManifest(bundleDirectory) {
  const manifestPath = resolve(bundleDirectory, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("manifest.json was not found.");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length) {
    throw new Error("Backup manifest does not contain artifacts.");
  }

  for (const artifact of manifest.artifacts) {
    const artifactPath = resolve(bundleDirectory, artifact.file);
    if (!existsSync(artifactPath)) {
      throw new Error(`Backup artifact is missing: ${artifact.file}`);
    }
    const actual = await sha256File(artifactPath);
    if (actual !== artifact.sha256) {
      throw new Error(`Backup artifact checksum failed: ${artifact.file}`);
    }
  }

  return manifest;
}

export async function verifyEncryptedManifest(bundleDirectory) {
  const manifestPath = resolve(bundleDirectory, "encrypted-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("encrypted-manifest.json was not found.");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error("Encrypted backup manifest does not contain files.");
  }

  for (const file of manifest.files) {
    const encryptedPath = resolve(bundleDirectory, file.encryptedFile);
    if (!existsSync(encryptedPath)) {
      throw new Error(`Encrypted backup file is missing: ${file.encryptedFile}`);
    }
    const actual = await sha256File(encryptedPath);
    if (actual !== file.sha256) {
      throw new Error(`Encrypted backup checksum failed: ${file.encryptedFile}`);
    }
  }

  return manifest;
}
