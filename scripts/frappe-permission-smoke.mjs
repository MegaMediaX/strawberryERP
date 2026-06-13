import { spawnSync } from "node:child_process";

const site = process.env.SITE_NAME || "lebtech.local";

const result = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "backend",
    "bench",
    "--site",
    site,
    "execute",
    "lebtech_partner_platform.validation.permission_matrix.run",
  ],
  { encoding: "utf8", env: process.env },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error(`Unable to run Docker Compose: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("Live Frappe permission matrix failed.");
  process.exit(result.status || 1);
}

console.log("PASS live Frappe permission matrix");
