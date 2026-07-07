// Live per-role lead-scoping isolation smoke (§4/§9) against a running stack.
//   node scripts/role-scoping-live-smoke.mjs [baseUrl]
// Logs in as each seeded role and asserts the Frappe-backed /api/frappe/leads
// returns only that role's scoped leads. Exits non-zero on any failure.

import { requireEnv } from "./load-env.mjs";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:8080";

const ROLES = [
  { name: "Super Admin", email: "ggkhoueiry@gmail.com", password: requireEnv("SEED_ADMIN_PW") },
  { name: "Regional Director", email: "maya.regional@lebtech.example", password: requireEnv("SEED_REGIONAL_PW") },
  { name: "Reseller Admin", email: "admin@beirutdigital.example", password: requireEnv("SEED_RESELLER_PW") },
  { name: "Sales Team User", email: "m.elmouallem@leb-tech.com", password: requireEnv("SEED_SALES_PW") },
];

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name} ${extra}`); fail++; }
}
function cookieOf(res) {
  const m = (res.headers.get("set-cookie") || "").match(/lebtech_session=([^;]+)/);
  return m ? `lebtech_session=${m[1]}` : "";
}
async function leadsFor(role) {
  const l = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: role.email, password: role.password }),
  });
  const cookie = cookieOf(l);
  const res = await fetch(`${BASE}/api/frappe/leads?pageSize=500`, { headers: { cookie } });
  const body = await res.json();
  const rows = body?.data?.message ?? body?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function main() {
  const sales = await leadsFor(ROLES[3]);
  check("Sales: non-empty result", sales.length > 0, `(${sales.length})`);
  check("Sales: every lead assigned to 'Marven El Mouallem'", sales.every((r) => r.assigned_user === "Marven El Mouallem"),
    `offenders=${sales.filter((r) => r.assigned_user !== "Marven El Mouallem").length}`);
  check("Sales: sees no Cyprus leads", sales.every((r) => r.country !== "Cyprus"));

  const reseller = await leadsFor(ROLES[2]);
  check("Reseller: non-empty result", reseller.length > 0, `(${reseller.length})`);
  check("Reseller: every lead reseller = 'Beirut Digital Partners'",
    reseller.every((r) => r.reseller === "Beirut Digital Partners"),
    `offenders=${reseller.filter((r) => r.reseller !== "Beirut Digital Partners").length}`);

  const regional = await leadsFor(ROLES[1]);
  check("Regional: non-empty result", regional.length > 0, `(${regional.length})`);
  check("Regional: only Lebanon/Jordan (no Cyprus/Syria)",
    regional.every((r) => r.country === "Lebanon" || r.country === "Jordan"),
    `offenders=${regional.filter((r) => !["Lebanon", "Jordan"].includes(r.country)).length}`);

  const sa = await leadsFor(ROLES[0]);
  check("Super Admin: sees Cyprus leads (no scope)", sa.some((r) => r.country === "Cyprus"));

  console.log(`\nsizes: sales=${sales.length} reseller=${reseller.length} regional=${regional.length} super=${sa.length}`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("ERROR", e); process.exit(1); });
