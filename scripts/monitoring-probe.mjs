import { connect } from "node:tls";
import { spawnSync } from "node:child_process";

const baseUrl = (process.env.MONITOR_BASE_URL || "http://localhost").replace(/\/$/, "");
const site = process.env.SITE_NAME || "lebtech.local";
const checks = [];

function compose(args) {
  const result = spawnSync("docker", ["compose", ...args], {
    encoding: "utf8",
    env: process.env,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

async function checkHttp(path, expectedStatus = 200) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    record(`http:${path}`, response.status === expectedStatus, {
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch {
    record(`http:${path}`, false, { error: "request_failed" });
  }
}

await checkHttp("/api/health");
await checkHttp("/api/health/live");
await checkHttp("/api/health/ready");
await checkHttp("/erpnext-api/api/method/ping", 404);

const ps = compose(["ps", "--format", "json"]);
if (!ps.ok) {
  record("compose:services", false, { error: "compose_ps_failed" });
} else {
  const services = ps.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const required = [
    "frontend",
    "backend",
    "nginx",
    "mariadb",
    "redis-cache",
    "redis-queue",
    "redis-socketio",
    "worker-short",
    "worker-long",
    "scheduler",
  ];
  const unhealthy = required.filter((name) => {
    const service = services.find((item) => item.Service === name);
    return !service || service.State !== "running" || (service.Health && service.Health !== "healthy");
  });
  record("compose:services", unhealthy.length === 0, { unhealthy });
}

const doctor = compose(["exec", "-T", "backend", "bench", "--site", site, "doctor"]);
const workerMatch = doctor.stdout.match(/Workers online:\s*(\d+)/i);
const workersOnline = workerMatch ? Number(workerMatch[1]) : 0;
record("frappe:workers_scheduler", doctor.ok && workersOnline >= 2 && !/scheduler (disabled|inactive)/i.test(doctor.stdout), {
  workersOnline,
});

const queue = compose([
  "exec",
  "-T",
  "redis-queue",
  "sh",
  "-lc",
  "for key in $(redis-cli --scan --pattern 'rq:queue:*'); do printf '%s=' \"$key\"; redis-cli LLEN \"$key\"; done",
]);
const queueDepth = queue.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .reduce((sum, line) => sum + Number(line.split("=").at(-1) || 0), 0);
record("frappe:queue_depth", queue.ok && queueDepth < Number(process.env.MONITOR_QUEUE_DEPTH_LIMIT || 100), {
  queueDepth,
});

const failedJobs = compose([
  "exec",
  "-T",
  "backend",
  "bench",
  "--site",
  site,
  "execute",
  "lebtech_partner_platform.validation.operations.failed_job_summary",
]);
const failedCount = Number((failedJobs.stdout.match(/["']total["']\s*:\s*(\d+)/) || [])[1] || 0);
record("frappe:failed_jobs", failedJobs.ok && failedCount <= Number(process.env.MONITOR_FAILED_JOB_LIMIT || 0), {
  failedCount,
});

const backup = compose([
  "exec",
  "-T",
  "backend",
  "bash",
  "-lc",
  `latest=$(find 'sites/${site}/private/backups' -maxdepth 1 -type f -name '*-database.sql.gz' -printf '%T@\\n' | sort -nr | head -1); now=$(date +%s); if [ -n \"$latest\" ]; then printf '%.0f' \"$((now-${"${latest%.*}"}))\"; else exit 1; fi`,
]);
const backupAgeSeconds = Number(backup.stdout.trim() || Number.POSITIVE_INFINITY);
record("backup:freshness", backup.ok && backupAgeSeconds <= Number(process.env.MONITOR_BACKUP_MAX_AGE_SECONDS || 129_600), {
  ageSeconds: Number.isFinite(backupAgeSeconds) ? backupAgeSeconds : null,
});

const disk = compose(["exec", "-T", "backend", "df", "-P", "/home/frappe/frappe-bench/sites"]);
const diskMatch = disk.stdout.match(/\s(\d+)%\s+\/[^\s]*\s*$/m);
const diskUsedPercent = diskMatch ? Number(diskMatch[1]) : null;
record("host:sites_disk", disk.ok && diskUsedPercent !== null && diskUsedPercent < Number(process.env.MONITOR_DISK_LIMIT_PERCENT || 80), {
  usedPercent: diskUsedPercent,
});

if (baseUrl.startsWith("https://")) {
  const url = new URL(baseUrl);
  const daysRemaining = await certificateDaysRemaining(url.hostname, Number(url.port || 443));
  record("tls:expiry", daysRemaining !== null && daysRemaining >= Number(process.env.MONITOR_TLS_MIN_DAYS || 21), {
    daysRemaining,
  });
}

const ok = checks.every((check) => check.ok);
console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), checks }, null, 2));
if (!ok) process.exitCode = 1;

function certificateDaysRemaining(hostname, port) {
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port, servername: hostname, timeout: 10_000 }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      if (!certificate.valid_to) return resolve(null);
      resolve(Math.floor((new Date(certificate.valid_to).getTime() - Date.now()) / 86_400_000));
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
    socket.on("error", () => resolve(null));
  });
}
