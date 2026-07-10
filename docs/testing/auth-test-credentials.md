# Auth / session / 2FA test credentials

`npm test` exercises real login/session/2FA code paths (`src/lib/auth/**`,
`src/app/api/auth/**`). Those routes need seed passwords that match the scrypt
hashes seeded in `src/lib/auth/credentials.ts`. This doc explains what's a
secret, what isn't, and how to get a green `npm test` locally and in CI.

## TL;DR

- **On a fresh clone with no env files and no secrets, `npm test` is still
  green.** A committed, deterministic test-only credential
  (`src/test/test-credentials.ts`) exercises the full login → session → 2FA
  suite without any secret being configured.
- Assertions that specifically need the **real** Super Admin password are
  gated with `describe.skipIf(!SEED_ADMIN_PW)` and print a console note when
  skipped — they never fail the suite, they just don't run.
- Only **one** variable is a real secret: `SEED_ADMIN_PW`.

## The four `SEED_*_PW` variables

| Variable | Real secret? | Used by |
| --- | --- | --- |
| `SEED_ADMIN_PW` | **Yes** — matches the real Super Admin scrypt hash (`ggkhoueiry@gmail.com`), identical to prod | `describe.skipIf(!SEED_ADMIN_PW)` parity blocks in `auth.test.ts`, `login-route.test.ts`, `session-route.test.ts`, `two-factor.test.ts` |
| `SEED_REGIONAL_PW` | No | `SEED_LOGINS` (unused by unit tests today; consumed by live-smoke scripts) |
| `SEED_RESELLER_PW` | No | same as above |
| `SEED_SALES_PW` | No | same as above |

`src/test/seed-credentials.ts` only throws (at most) for `SEED_ADMIN_PW`, and
even that no longer crashes module import — it resolves to `undefined` when
unset instead. `vitest.setup.ts` applies committed, non-sensitive fallback
values for the other three so they're always defined.

## The test-only fixture (`TI-4`)

`src/lib/auth/credentials.ts` wires a **second**, independently-accepted
scrypt hash onto the Super Admin credential record: `testOnlyPasswordHash`.
It is the hash of the synthetic, committed plaintext
`TEST_ONLY_SUPER_ADMIN_PW` (`src/test/test-credentials.ts`) and is only ever
populated outside `NODE_ENV=production` — a narrow, guarded test seam, never
shipped to prod.

This lets `authenticate()` accept **either** the real password **or** the
test-only one for `ggkhoueiry@gmail.com` / `USR-SUPER` in dev/test builds, so
route tests can log in as Super Admin without the real secret while still
exercising the exact same code path prod would use.

## Running locally

Nothing is required. `npm test` is green out of the box.

If you want the real-secret parity assertions to also run (recommended
before touching `src/lib/auth/credentials.ts` or the login route), set
`SEED_ADMIN_PW` in one of:

- your untracked `.env` (shared dev bootstrap file, see `.env.example`), or
- an untracked `.env.test` (loaded by `vitest.setup.ts` after `.env`, so it
  can override just the test seed passwords without touching the full
  Frappe/Docker config in `.env`)

```
SEED_ADMIN_PW=<the real dev/staging Super Admin password>
```

Never commit either file — both are covered by the `.env*` pattern in
`.gitignore`.

## Running in CI

`.github/workflows/ci.yml` injects `SEED_ADMIN_PW` from the
`secrets.SEED_ADMIN_PW` repository secret, and hardcodes the three
non-secret fallbacks as literals (kept in sync with the fallbacks in
`vitest.setup.ts` / `src/test/seed-credentials.ts`). If the repo secret is
ever unset, the job does **not** fail — the real-secret parity assertions
skip (with a console note in the job log) and the rest of the suite,
including the test-only fixture coverage, still runs and still gates the
build.

## Rotating the real Super Admin password

If `SEED_ADMIN_PW` (and its matching hash in `src/lib/auth/credentials.ts`)
is ever rotated, update the `secrets.SEED_ADMIN_PW` GitHub Actions secret to
match. The test-only fixture is independent and needs no change.
