// Live 2FA lifecycle smoke against a running stack.
//   node scripts/2fa-live-smoke.mjs [baseUrl] [email] [password]
// Verifies: setup -> activate -> login-requires-2FA -> login-with-code -> disable -> login-without-code.
// Exits non-zero on any failed assertion. Computes TOTP locally (RFC 6238).
import crypto from "node:crypto";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:8080";
const EMAIL = process.argv[3] || "super.admin@lebtech.example";
const PASSWORD = process.argv[4] || "LebTech!Admin#2026";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32dec(s) {
  let bits = 0, val = 0;
  const out = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret, t = Math.floor(Date.now() / 1000)) {
  const key = b32dec(secret);
  const ctr = Math.floor(t / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(ctr / 0x100000000), 0);
  buf.writeUInt32BE(ctr >>> 0, 4);
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return (bin % 1e6).toString().padStart(6, "0");
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`PASS ${name}`); pass++; }
  else { console.log(`FAIL ${name}`); fail++; }
}
function cookieOf(res) {
  const sc = res.headers.get("set-cookie") || "";
  const m = sc.match(/lebtech_session=([^;]+)/);
  return m ? `lebtech_session=${m[1]}` : "";
}
async function login(body, cookie) {
  return fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function main() {
  // 1. login (password only) -> session cookie
  const l1 = await login({ email: EMAIL, password: PASSWORD });
  check("login (password only) -> 200", l1.status === 200);
  const cookie = cookieOf(l1);
  check("session cookie issued", cookie !== "");

  // 2. setup -> secret
  const setup = await fetch(`${BASE}/api/auth/2fa/setup`, { method: "POST", headers: { cookie } });
  const setupBody = await setup.json();
  const secret = setupBody?.data?.secret;
  check("2fa setup -> 200 + secret", setup.status === 200 && !!secret);

  // 3. activate with wrong code -> 400
  const badAct = await fetch(`${BASE}/api/auth/2fa/activate`, {
    method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code: "000000" }),
  });
  check("activate wrong code -> 400", badAct.status === 400);

  // 4. activate with valid code -> 200
  const act = await fetch(`${BASE}/api/auth/2fa/activate`, {
    method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code: totp(secret) }),
  });
  check("activate valid code -> 200", act.status === 200);

  // 5. login without code now requires 2FA -> 401
  const l2 = await login({ email: EMAIL, password: PASSWORD });
  check("login w/o code now requires 2FA -> 401", l2.status === 401);

  // 6. login with code -> 200
  const l3 = await login({ email: EMAIL, password: PASSWORD, totp: totp(secret) });
  check("login with valid 2FA code -> 200", l3.status === 200);

  // 7. disable -> 200 (use a fresh authed cookie)
  const disableCookie = cookieOf(l3) || cookie;
  const dis = await fetch(`${BASE}/api/auth/2fa/disable`, { method: "POST", headers: { cookie: disableCookie } });
  check("disable 2fa -> 200", dis.status === 200);

  // 8. login without code works again -> 200
  const l4 = await login({ email: EMAIL, password: PASSWORD });
  check("login (password only) works after disable -> 200", l4.status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("ERROR", e); process.exit(1); });
