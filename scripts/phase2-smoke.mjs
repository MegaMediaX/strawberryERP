import { existsSync, readFileSync } from "node:fs";

const files = {
  phase2Data: readFileSync("src/lib/phase2-data.ts", "utf8"),
  apiRoute: readFileSync("src/app/api/frappe/[...resource]/route.ts", "utf8"),
  leadsRoute: readFileSync("src/app/api/frappe/leads/route.ts", "utf8"),
  whatsappRoute: readFileSync("src/app/api/frappe/integrations/whatsapp/route.ts", "utf8"),
  openapi: readFileSync("docs/openapi.yaml", "utf8"),
  readme: readFileSync("README.md", "utf8"),
  architecture: readFileSync("docs/architecture.md", "utf8"),
  liveBenchRunbook: existsSync("docs/live-bench-runbook.md") ? readFileSync("docs/live-bench-runbook.md", "utf8") : "",
  frappeLiveValidation: readFileSync("docs/frappe-live-validation.md", "utf8"),
  productionChecklist: existsSync("docs/production-deployment-checklist.md") ? readFileSync("docs/production-deployment-checklist.md", "utf8") : "",
  backupRestore: existsSync("docs/backup-restore.md") ? readFileSync("docs/backup-restore.md", "utf8") : "",
  stagingDeployment: existsSync("docs/staging-deployment.md") ? readFileSync("docs/staging-deployment.md", "utf8") : "",
  productionBlockers: existsSync("docs/production-blockers.md") ? readFileSync("docs/production-blockers.md", "utf8") : "",
  ci: existsSync(".github/workflows/ci.yml") ? readFileSync(".github/workflows/ci.yml", "utf8") : "",
  dockerignore: existsSync(".dockerignore") ? readFileSync(".dockerignore", "utf8") : "",
  packageJson: readFileSync("package.json", "utf8"),
  adminIntegrations: readFileSync("src/lib/admin/integrations.ts", "utf8"),
  googleCalendarPage: readFileSync("src/app/admin/integrations/google-calendar/page.tsx", "utf8"),
  googleDrivePage: readFileSync("src/app/admin/integrations/google-drive/page.tsx", "utf8"),
  adminInvoiceDetail: readFileSync("src/app/admin/invoices/[id]/page.tsx", "utf8"),
  adminReceiptDetail: readFileSync("src/app/admin/receipts/[id]/page.tsx", "utf8"),
  portalSecurity: readFileSync("src/lib/portal-security.ts", "utf8"),
  devStore: readFileSync("src/lib/dev-store.ts", "utf8"),
  securityApi: readFileSync("frappe_app/lebtech_partner_platform/lebtech_partner_platform/api/security.py", "utf8"),
  permissions: readFileSync("src/lib/security/permissions.ts", "utf8"),
  backendRouter: readFileSync("src/lib/backend/backend-router.ts", "utf8"),
  backendClient: readFileSync("src/lib/backend/backend-client.ts", "utf8"),
  devStoreClient: readFileSync("src/lib/backend/dev-store-client.ts", "utf8"),
  frappeReadme: readFileSync("frappe_app/lebtech_partner_platform/README.md", "utf8"),
  env: readFileSync(".env.example", "utf8"),
  compose: readFileSync("docker-compose.yml", "utf8"),
  nginx: readFileSync("infra/nginx/default.conf", "utf8"),
  nextConfig: readFileSync("next.config.ts", "utf8"),
  productionPreflight: readFileSync("scripts/production-preflight.mjs", "utf8"),
  backupExport: readFileSync("scripts/frappe-backup-export.mjs", "utf8"),
  edgeSmoke: readFileSync("scripts/edge-smoke.mjs", "utf8"),
  monitoringProbe: readFileSync("scripts/monitoring-probe.mjs", "utf8"),
  backupOffhost: readFileSync("scripts/backup-offhost.mjs", "utf8"),
  verifyBackup: readFileSync("scripts/verify-backup.mjs", "utf8"),
  productionNginx: readFileSync("deploy/nginx/production.conf.example", "utf8"),
  productionEnv: readFileSync(".env.production.example", "utf8"),
  domainTls: readFileSync("docs/domain-tls.md", "utf8"),
  secretManagement: readFileSync("docs/secret-management.md", "utf8"),
  monitoring: readFileSync("docs/monitoring.md", "utf8"),
  ingressWaf: readFileSync("docs/ingress-waf.md", "utf8"),
  dependencyRisk: readFileSync("docs/dependency-risk-register.md", "utf8"),
  launchChecklist: readFileSync("docs/launch-candidate-checklist.md", "utf8"),
  routeAccess: readFileSync("src/lib/security/route-access.ts", "utf8"),
  protectedRoute: readFileSync("src/components/security/ProtectedRoute.tsx", "utf8"),
  portalNavigation: readFileSync("src/components/platform/PortalNavigation.tsx", "utf8"),
  uiData: readFileSync("src/lib/ui-data.ts", "utf8"),
  adminLeadsPage: readFileSync("src/app/admin/leads/page.tsx", "utf8"),
  adminLeadsView: readFileSync("src/components/admin/AdminLeadsView.tsx", "utf8"),
  operationsApi: readFileSync("frappe_app/lebtech_partner_platform/lebtech_partner_platform/api/operations.py", "utf8"),
};

const checks = [
  ["invoice create route", files.apiRoute.includes('contextKey === "invoices"') && files.apiRoute.includes("createInvoiceFromPayload")],
  ["receipt create route", files.apiRoute.includes('contextKey === "receipts"') && files.apiRoute.includes("createReceiptFromPayload")],
  ["commission formula", files.phase2Data.includes("commissionAmount") && files.phase2Data.includes("rule.commissionPercentage") && files.phase2Data.includes("/ 100")],
  ["API key generation", files.phase2Data.includes("generateApiKeyRecord") && files.phase2Data.includes("plainTextKey")],
  ["no DELETE API access", files.apiRoute.includes("deleteNotAllowed") && files.leadsRoute.includes("deleteNotAllowed") && !files.openapi.includes("\n    delete:")],
  ["blocked Israel validation", files.phase2Data.includes("blockedCountries") && files.phase2Data.includes("Country is not enabled")],
  ["WhatsApp provider config", files.whatsappRoute.includes("Meta WhatsApp Cloud API") && files.whatsappRoute.includes("WasenderAPI.com")],
  ["Google Calendar config page", files.googleCalendarPage.includes('IntegrationType = "Google Calendar"') && files.adminIntegrations.includes('"Google Calendar"') && files.adminIntegrations.includes("Default Calendar ID")],
  ["Google Drive config page", files.googleDrivePage.includes('IntegrationType = "Google Drive"') && files.adminIntegrations.includes('"Google Drive"') && files.adminIntegrations.includes("Root folder ID")],
  ["CSV import validation", files.phase2Data.includes("validateImportCsv") && files.apiRoute.includes('contextKey === "import/leads"')],
  ["portal session model", files.portalSecurity.includes("resolvePortalSession") && files.portalSecurity.includes("impersonatedBy")],
  ["impersonation audit", files.apiRoute.includes("session/impersonation") && files.securityApi.includes("impersonation_started")],
  ["delete queue workflow", files.devStore.includes("enqueueDelete") && files.apiRoute.includes("settings/delete-queue") && files.securityApi.includes("resolve_delete_request")],
  ["backend adapter files", files.backendRouter.includes("maybeRouteToFrappe") && files.backendClient.includes("frappeMethodMap")],
  ["dev-store source marker", files.apiRoute.includes("devStoreResponse") && files.devStoreClient.includes('"dev-store"')],
  ["permission middleware", files.permissions.includes("authorizeApiRequest") && files.permissions.includes("Sensitive actions are blocked while impersonating")],
  ["API key hardening", files.permissions.includes("API key is expired") && files.permissions.includes("API key is revoked") && files.permissions.includes("administrative route") && files.phase2Data.includes("revokedAt")],
  ["customer import validation", files.phase2Data.includes("validateCustomerImportCsv") && files.apiRoute.includes('contextKey === "import/customers"')],
  ["integration persistence", files.devStore.includes("upsertIntegrationSetting") && files.whatsappRoute.includes("integration_setting_changed")],
  ["production delete aliases", files.apiRoute.includes("delete-queue/request") && files.apiRoute.includes("delete-queue/resolve")],
  ["phase3 doctypes", [
    "partner_country",
    "partner_customer",
    "portal_role_assignment",
    "portal_session_audit",
    "partner_invoice",
    "partner_receipt",
    "commission_payment",
    "expense_log",
    "pnl_snapshot",
    "portal_api_key",
    "global_portal_setting",
  ].every((name) => existsSync(`frappe_app/lebtech_partner_platform/lebtech_partner_platform/lebtech_partner_platform/doctype/${name}/${name}.json`))],
  ["seed script excludes Israel", files.frappeReadme.includes("seed.execute") && readFileSync("frappe_app/lebtech_partner_platform/lebtech_partner_platform/seed.py", "utf8").includes("COUNTRIES = [\"Lebanon\", \"Cyprus\", \"Jordan\", \"Syria\"]")],
  ["env phase3 secrets", files.env.includes("PORTAL_SESSION_SECRET") && files.env.includes("PORTAL_API_KEY_SECRET")],
  ["docker health checks", files.compose.includes("healthcheck:") && files.compose.includes("redis-cache-data")],
  ["openapi no delete scopes", !files.openapi.includes("delete:") && !files.openapi.includes("delete:") && !files.openapi.includes("delete:leads")],
  ["standard success envelope", files.backendRouter.includes("ok: true") && files.backendRouter.includes("source: result.source") && files.backendRouter.includes("source: devStoreSource")],
  ["standard error envelope", files.openapi.includes("ErrorResponse") && files.apiRoute.includes("jsonError") && readFileSync("src/lib/api-helpers.ts", "utf8").includes("ok: false")],
  ["integration secrets redacted", files.devStore.includes('"********"') && files.whatsappRoute.includes('"********"') && readFileSync("frappe_app/lebtech_partner_platform/lebtech_partner_platform/api/settings.py", "utf8").includes('"********"')],
  ["sales accounting denied", files.permissions.includes('resource.startsWith("invoices")') && files.permissions.includes('resource.startsWith("receipts")')],
  ["phase4 ci workflow", files.ci.includes("npm ci") && files.ci.includes("node --check scripts/frappe-live-smoke.mjs") && files.ci.includes("frappe-live-smoke")],
  ["phase4 production docs", files.liveBenchRunbook.includes("bench init frappe-bench") && files.productionChecklist.includes("no delete API scopes") && files.backupRestore.includes("bench --site lebtech.local backup")],
  ["phase5 staging and blockers docs", files.stagingDeployment.includes("docker compose build") && files.productionBlockers.includes("P0 = cannot deploy") && files.productionBlockers.includes("Live Frappe bench unavailable")],
  ["docker build hardening", files.dockerignore.includes("node_modules") && files.dockerignore.includes(".next") && files.packageJson.includes("lightningcss-linux-x64-gnu") && files.packageJson.includes("@tailwindcss/oxide-linux-x64-gnu")],
  ["readme phase4 links", files.readme.includes("docs/live-bench-runbook.md") && files.readme.includes("docs/production-deployment-checklist.md") && files.readme.includes("docs/backup-restore.md")],
  ["readme phase5 links", files.readme.includes("docs/staging-deployment.md") && files.readme.includes("docs/production-blockers.md")],
  ["phase8 health endpoints", existsSync("src/app/api/health/live/route.ts") && existsSync("src/app/api/health/ready/route.ts") && files.compose.includes("/api/health/ready")],
  ["phase8 edge isolation", files.compose.includes('127.0.0.1:${FRAPPE_PORT:-8000}:8000') && files.nginx.includes("location ^~ /erpnext-api/") && files.nginx.includes("return 404;")],
  ["phase8 edge headers and rate limit", files.nginx.includes("X-Request-ID") && files.nginx.includes("limit_req zone=portal_api") && files.nextConfig.includes("poweredByHeader: false")],
  ["phase8 operations tooling", files.productionPreflight.includes("PASS production preflight") && files.backupExport.includes("manifest.json") && files.edgeSmoke.includes("generic public Frappe tunnel is blocked")],
  ["phase9 aggregate health", existsSync("src/app/api/health/route.ts") && files.openapi.includes("/api/health:")],
  ["phase9 secret file support", existsSync("src/lib/secret-env.ts") && files.productionEnv.includes("FRAPPE_API_SECRET_FILE") && files.secretManagement.includes("Emergency Revocation")],
  ["phase9 TLS and WAF template", files.productionNginx.includes("Strict-Transport-Security") && files.productionNginx.includes("/erpnext-api/") && files.ingressWaf.includes("Cloudflare or WAF Rules")],
  ["phase9 encrypted off-host backup", files.backupOffhost.includes("AES-256-GCM") || files.backupOffhost.includes("encryptFile") && files.verifyBackup.includes("verifyEncryptedManifest")],
  ["phase9 monitoring probe", files.monitoringProbe.includes("frappe:queue_depth") && files.monitoring.includes("TLS expiry")],
  ["phase9 dependency register", files.dependencyRisk.includes("GHSA-qx2v-qp2m-jg93") && files.dependencyRisk.includes("Do not downgrade")],
  ["phase9 launch checklist", files.launchChecklist.includes("## Go/No-Go") && files.domainTls.includes("certbot renew --dry-run")],
  ["phase9a protected UI routes", files.routeAccess.includes("requiresTrueSuperAdmin") && files.routeAccess.includes("blockedWhenImpersonating") && files.protectedRoute.includes("Login required")],
  ["phase9a detail 404 handling", files.adminInvoiceDetail.includes("Invoice not found") && files.adminReceiptDetail.includes("Receipt not found") && !files.adminInvoiceDetail.includes("?? invoices[0]") && !files.adminReceiptDetail.includes("?? receipts[0]")],
  ["phase9a Frappe-backed UI", files.uiData.includes("isFrappeConfigured") && files.uiData.includes("frappeBackendClient.handle") && files.uiData.includes("getUiRows") && files.operationsApi.includes("list_resellers") && files.operationsApi.includes("list_contracts")],
  ["phase9a leads workspace", files.adminLeadsPage.includes("AdminLeadsView") && files.adminLeadsPage.includes("getUiLeads") && files.adminLeadsView.includes("filterLeads") && files.adminLeadsView.includes("Search leads")],
  ["phase9a grouped mobile navigation", files.portalNavigation.includes('label: "Accounting"') && files.portalNavigation.includes('label: "Integrations"') && files.portalNavigation.includes('label: "Admin"') && files.portalNavigation.includes("Open navigation menu")],
];

const failed = checks.filter(([, passed]) => !passed);

for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

if (failed.length) {
  process.exitCode = 1;
}

if (!failed.length && process.env.SMOKE_BASE_URL) {
  await runHttpSmoke(process.env.SMOKE_BASE_URL.replace(/\/$/, ""));
} else if (!process.env.SMOKE_BASE_URL) {
  console.log("SKIP HTTP smoke (set SMOKE_BASE_URL to run API boundary checks)");
}

async function runHttpSmoke(baseUrl) {
  const cases = [
    ...["/settings/api", "/settings/impersonation", "/settings/delete-queue", "/settings/roles-permissions", "/audit-logs"].map((path) => ({
      name: `unauthenticated UI ${path} is protected`,
      request: () => fetch(`${baseUrl}${path}`),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes("Login required") && !text.includes("Generate key") && !text.includes("Start impersonation") && !text.includes("Permanently delete");
      },
    })),
    ...[
      ["Sales User", "USR-SALES-RAMI"],
      ["Regional Director", "USR-REG-LB"],
      ["Reseller Admin", "USR-RESELLER-BDP"],
    ].map(([role, userId]) => ({
      name: `${role} cannot access API settings UI`,
      request: () => fetch(`${baseUrl}/settings/api`, { headers: { "x-platform-user-id": userId } }),
      expect: async (response) => response.ok && (await response.text()).includes("Access denied"),
    })),
    {
      name: "impersonating Super Admin cannot access delete queue UI",
      request: () => fetch(`${baseUrl}/settings/delete-queue`, { headers: { "x-platform-user-id": "USR-SUPER", "x-platform-impersonate-user-id": "USR-SALES-RAMI" } }),
      expect: async (response) => response.ok && (await response.text()).includes("You cannot access this page while impersonating another user."),
    },
    {
      name: "true Super Admin can access delete queue UI",
      request: () => fetch(`${baseUrl}/settings/delete-queue`, { headers: { "x-platform-user-id": "USR-SUPER" } }),
      expect: async (response) => response.ok && (await response.text()).includes("Delete queue"),
    },
    {
      name: "missing invoice detail does not leak another record",
      request: () => fetch(`${baseUrl}/accounting/invoices/does-not-exist`, { headers: { "x-platform-user-id": "USR-SUPER" } }),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes("Invoice not found") && !text.includes("LB-2026-0041");
      },
    },
    {
      name: "missing receipt detail does not leak another record",
      request: () => fetch(`${baseUrl}/accounting/receipts/does-not-exist`, { headers: { "x-platform-user-id": "USR-SUPER" } }),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes("Receipt not found") && !text.includes("RCPT-2026-0032");
      },
    },
    {
      name: "Leads UI route exists and uses configured source",
      request: () => fetch(`${baseUrl}/leads`, { headers: { "x-platform-user-id": "USR-SUPER" } }),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes("Lead filters") && text.includes("Source:") && (text.includes("frappe") || text.includes("dev-store"));
      },
    },
    {
      name: "Customers UI marks Customers active instead of Settings",
      request: () => fetch(`${baseUrl}/customers`, { headers: { "x-platform-user-id": "USR-SUPER" } }),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes('href="/customers"') && text.includes('aria-current="page"');
      },
    },
    {
      name: "configured backend source",
      request: () => fetch(`${baseUrl}/api/frappe/session`),
      expect: async (response) => {
        const text = await response.text();
        return response.ok && text.includes('"ok":true') && (text.includes('"source":"dev-store"') || text.includes('"source":"frappe"'));
      },
    },
    {
      name: "standardized validation error shape",
      request: () =>
        fetch(`${baseUrl}/api/frappe/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: "Smoke Co",
            country: "Lebanon",
            assignedUser: "Rami K.",
            contactFirstName: "Sam",
            contactLastName: "Smoke",
            gender: "Male",
            phone: "+961 70 000 000",
            email: "sam.smoke@example.com",
            status: "Scheduled Follow-Up",
          }),
        }),
      expect: async (response) => {
        const body = await response.json();
        return response.status === 400 && body.ok === false && body.error?.code === "VALIDATION_ERROR";
      },
    },
    {
      name: "Regional Director cannot create API keys",
      request: () =>
        fetch(`${baseUrl}/api/frappe/settings/api/keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-platform-user-id": "USR-REG-LB" },
          body: JSON.stringify({ keyName: "Denied", scopes: ["read:leads"], readAccess: true, writeAccess: false }),
        }),
      expect: async (response) => response.status === 403,
    },
    {
      name: "read-only API key cannot write",
      request: () =>
        fetch(`${baseUrl}/api/frappe/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-platform-api-key-id": "APIK-READONLY" },
          body: JSON.stringify({ country: "Lebanon", reseller: "Beirut Digital Partners", customer: "Cedar Cloud Services", currency: "USD", lineItems: [] }),
        }),
      expect: async (response) => response.status === 403,
    },
    {
      name: "API key cannot read admin key settings",
      request: () => fetch(`${baseUrl}/api/frappe/settings/api/keys`, { headers: { "x-platform-api-key-id": "APIK-001" } }),
      expect: async (response) => response.status === 403,
    },
    {
      name: "API key cannot read session route",
      request: () => fetch(`${baseUrl}/api/frappe/session`, { headers: { "x-platform-api-key-id": "APIK-001" } }),
      expect: async (response) => response.status === 403,
    },
    {
      name: "Sales User cannot access invoices",
      request: () => fetch(`${baseUrl}/api/frappe/invoices`, { headers: { "x-platform-user-id": "USR-SALES-RAMI" } }),
      expect: async (response) => response.status === 403,
    },
    {
      name: "Reseller Admin cannot see other reseller invoice data",
      request: () => fetch(`${baseUrl}/api/frappe/invoices`, { headers: { "x-platform-user-id": "USR-RESELLER-BDP" } }),
      expect: async (response) => {
        const body = await response.json();
        const serialized = JSON.stringify(body);
        if (!response.ok || serialized.includes("MedTech Channel CY")) {
          return false;
        }
        return body.source === "frappe" || serialized.includes("Beirut Digital Partners");
      },
    },
    {
      name: "expired API key fails",
      request: () => fetch(`${baseUrl}/api/frappe/leads`, { headers: { "x-platform-api-key-id": "APIK-EXPIRED" } }),
      expect: async (response) => response.status === 401,
    },
    {
      name: "revoked API key fails",
      request: () => fetch(`${baseUrl}/api/frappe/leads`, { headers: { "x-platform-api-key-id": "APIK-REVOKED" } }),
      expect: async (response) => response.status === 401,
    },
    {
      name: "scheduled follow-up requires date",
      request: () =>
        fetch(`${baseUrl}/api/frappe/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: "Smoke Co",
            country: "Lebanon",
            assignedUser: "Rami K.",
            contactFirstName: "Sam",
            contactLastName: "Smoke",
            gender: "Male",
            phone: "+961 70 000 000",
            email: "sam.smoke@example.com",
            status: "Scheduled Follow-Up",
          }),
        }),
      expect: async (response) => response.status === 400,
    },
    {
      name: "HTTP DELETE remains blocked",
      request: () => fetch(`${baseUrl}/api/frappe/invoices`, { method: "DELETE" }),
      expect: async (response) => {
        const body = await response.json();
        return response.status === 405 && body.ok === false && body.error?.code === "METHOD_NOT_ALLOWED";
      },
    },
    {
      name: "integration secrets are redacted",
      request: () =>
        fetch(`${baseUrl}/api/frappe/integrations/whatsapp`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-platform-user-id": "USR-SUPER" },
          body: JSON.stringify({ provider: "meta", config: { appSecret: "raw-secret", permanentAccessToken: "raw-token", webhookUrl: "https://example.test/hook" } }),
        }),
      expect: async (response) => {
        const body = await response.json();
        const text = JSON.stringify(body);
        return response.ok && text.includes("********") && !text.includes("raw-secret") && !text.includes("raw-token");
      },
    },
    {
      name: "impersonating Super Admin cannot resolve delete queue",
      request: () =>
        fetch(`${baseUrl}/api/frappe/delete-queue/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-platform-user-id": "USR-SUPER",
            "x-platform-impersonate-user-id": "USR-SALES-RAMI",
          },
          body: JSON.stringify({ id: "DEL-9001", action: "restore" }),
        }),
      expect: async (response) => response.status === 403,
    },
  ];

  for (const testCase of cases) {
    const response = await testCase.request();
    const passed = await testCase.expect(response);
    console.log(`${passed ? "PASS" : "FAIL"} HTTP ${testCase.name}`);
    if (!passed) {
      process.exitCode = 1;
    }
  }
}
