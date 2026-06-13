import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream, openSync, closeSync, readSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("LBK1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

export async function encryptFile(input, output, passphrase) {
  validatePassphrase(passphrase);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const destination = createWriteStream(output, { flags: "wx" });
  destination.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(input), cipher, destination, { end: false });
  destination.end(cipher.getAuthTag());
  await new Promise((resolve, reject) => {
    destination.on("close", resolve);
    destination.on("error", reject);
  });
}

export async function decryptFile(input, output, passphrase) {
  validatePassphrase(passphrase);
  const size = statSync(input).size;
  if (size <= HEADER_BYTES + TAG_BYTES) {
    throw new Error("Encrypted backup file is truncated.");
  }

  const descriptor = openSync(input, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  readSync(descriptor, header, 0, HEADER_BYTES, 0);
  readSync(descriptor, tag, 0, TAG_BYTES, size - TAG_BYTES);
  closeSync(descriptor);

  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Encrypted backup file has an unsupported format.");
  }

  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = header.subarray(MAGIC.length + SALT_BYTES, HEADER_BYTES);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  await pipeline(
    createReadStream(input, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }),
    decipher,
    createWriteStream(output, { flags: "wx" }),
  );
}

function validatePassphrase(passphrase) {
  if (!passphrase || passphrase.length < 32) {
    throw new Error("Backup encryption key must contain at least 32 characters.");
  }
}
