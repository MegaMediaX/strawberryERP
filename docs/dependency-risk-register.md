# Dependency Risk Register

Review date: July 12, 2026, or immediately when a supported Next.js release updates the bundled PostCSS dependency.

| Package | Severity | Affected path | Decision | Mitigation and monitoring |
| --- | --- | --- | --- | --- |
| `postcss <8.5.10` | Moderate, GHSA-qx2v-qp2m-jg93 | `next -> postcss` | Accepted temporarily. `npm audit fix --force` proposes Next.js `9.3.3`, which is an unsafe major downgrade and incompatible with this Next.js 16 application. | No untrusted runtime CSS is accepted or stringified. Keep CSP/security headers and dependency scanning active. Re-test each supported Next.js update and upgrade once the bundled dependency is fixed. |
| `next` audit finding | Moderate, inherited from PostCSS | Direct dependency `next@16.2.7` | No independent exploit path was reported by the current audit; it is the parent dependency carrying the vulnerable nested PostCSS version. Do not downgrade. | Pin the tested Next.js version, monitor Next.js security advisories and release notes, run `npm audit` in CI/release review, and prioritize a compatible patched release. |

Current audit status on June 12, 2026: two moderate findings, zero high, zero critical. Any high or critical production dependency finding is a release blocker unless formally reviewed with compensating controls.
