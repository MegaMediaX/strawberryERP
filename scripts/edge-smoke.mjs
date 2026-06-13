const baseUrl = process.env.EDGE_BASE_URL?.replace(/\/$/, "");

if (!baseUrl) {
  console.error("EDGE_BASE_URL is required, for example http://localhost:8080");
  process.exit(1);
}

async function check(name, callback) {
  try {
    const passed = await callback();
    console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : "request failed"}`);
    process.exitCode = 1;
  }
}

await check("edge liveness", async () => {
  const response = await fetch(`${baseUrl}/api/health/live`);
  const body = await response.json();
  return response.ok && body.ok === true && body.status === "alive";
});

await check("edge readiness", async () => {
  const response = await fetch(`${baseUrl}/api/health/ready`);
  const body = await response.json();
  return response.ok && body.ok === true && body.status === "ready" && body.checks?.frappe?.ready === true;
});

await check("edge security and request-id headers", async () => {
  const response = await fetch(`${baseUrl}/api/health/live`);
  const server = response.headers.get("server") || "";
  return (
    response.headers.get("x-content-type-options") === "nosniff" &&
    response.headers.get("x-frame-options") === "SAMEORIGIN" &&
    Boolean(response.headers.get("x-request-id")) &&
    !/nginx\/[0-9]/i.test(server) &&
    !response.headers.has("x-powered-by")
  );
});

await check("generic public Frappe tunnel is blocked", async () => {
  const response = await fetch(`${baseUrl}/erpnext-api/api/method/ping`);
  return response.status === 404;
});

await check("DELETE remains blocked by the portal API boundary", async () => {
  const response = await fetch(`${baseUrl}/api/frappe/invoices`, { method: "DELETE" });
  const body = await response.json();
  return response.status === 405 && body.ok === false && body.error?.code === "METHOD_NOT_ALLOWED";
});

if (!process.exitCode) console.log("PASS edge smoke");
