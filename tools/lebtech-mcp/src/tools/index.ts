import type { ToolSpec } from "../registry.js";
import { healthTools } from "./health.js";
import { leadTools } from "./leads.js";
import { customerTools } from "./customers.js";
import { billingTools } from "./billing.js";
import { reportTools } from "./reports.js";
import { adminTools } from "./admin.js";
import { telephonyTools } from "./telephony.js";
import { destructiveTools } from "./destructive.js";
import { frappeTierTools } from "./frappe-tier.js";

export const allTools: ToolSpec[] = [
  ...healthTools,
  ...leadTools,
  ...customerTools,
  ...billingTools,
  ...reportTools,
  ...adminTools,
  ...telephonyTools,
  ...destructiveTools,
  ...frappeTierTools,
];
