import { readFileSync } from "node:fs";

export function readRuntimeValue(name: string) {
  const direct = process.env[name]?.trim();
  if (direct) {
    return direct;
  }

  const file = process.env[`${name}_FILE`]?.trim();
  if (!file) {
    return undefined;
  }

  try {
    const value = readFileSync(file, "utf8").trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export function hasRuntimeValue(name: string) {
  return Boolean(readRuntimeValue(name));
}
