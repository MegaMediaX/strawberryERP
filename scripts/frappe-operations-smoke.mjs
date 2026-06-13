import { spawnSync } from "node:child_process";

const site = process.env.SITE_NAME || "lebtech.local";
const marker = `phase7-${Date.now()}`;

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

function execute(method, kwargs) {
  const args = ["exec", "-T", "backend", "bench", "--site", site, "execute", method];
  if (kwargs) args.push("--kwargs", JSON.stringify(kwargs));
  return compose(args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const services = compose(["ps", "--status", "running", "--services"]);
  for (const required of ["backend", "worker-short", "scheduler"]) {
    if (!services.split(/\r?\n/).includes(required)) {
      throw new Error(`Required Compose service is not running: ${required}`);
    }
  }
  console.log("PASS backend, short worker, and scheduler services are running");

  const doctor = compose(["exec", "-T", "backend", "bench", "--site", site, "doctor"]);
  process.stdout.write(doctor);
  if (/scheduler (disabled|inactive)/i.test(doctor)) {
    throw new Error("Frappe scheduler is disabled or inactive for the site.");
  }
  console.log("PASS Frappe scheduler and worker doctor check");

  execute("lebtech_partner_platform.validation.operations.enqueue_worker_probe", { marker });
  let completed = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const output = execute("lebtech_partner_platform.validation.operations.get_worker_probe", { marker });
    if (/['\"]completed['\"]\s*:\s*(true|True)/.test(output)) {
      completed = true;
      break;
    }
    await sleep(1000);
  }
  if (!completed) throw new Error("Short worker did not persist the queue probe within 30 seconds.");
  console.log("PASS short worker executed and persisted the queue probe");

  compose(["exec", "-T", "backend", "bench", "--site", site, "backup", "--with-files"], { stdio: "inherit" });
  const backupOutput = execute("lebtech_partner_platform.validation.operations.latest_backup_files");
  if (!/['\"]files['\"]\s*:\s*\[(?!\s*\])/.test(backupOutput)) {
    throw new Error("Frappe backup completed but no backup artifacts were found.");
  }
  console.log("PASS Frappe database and file backup artifacts exist");
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      execute("lebtech_partner_platform.validation.operations.clear_worker_probe", { marker });
    } catch {
      // Preserve the primary failure; probe records are harmless and uniquely named.
    }
  });
