import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { buildPermissionContext, filterByPermission } from "@/lib/phase2-data";
import { allowedCountries, leads, leadStatuses, type Country } from "@/lib/sample-data";
import { resolvePortalSession, roleHeadersFromSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import { validateLeadTransition } from "@/lib/business/lead-workflow";
import { canAssignLeadTo } from "@/lib/security/assignable-users";
import { paginate } from "@/lib/query/scoped-page";
import { frappePaginationParams } from "@/lib/query/frappe-pagination";
import { leadsScopeForFrappe } from "@/lib/security/leads-scope";
import { getCreatedLeads } from "@/lib/dev-store";

type LeadPayload = {
  companyName?: string;
  country?: string;
  assignedUser?: string;
  contactFirstName?: string;
  contactLastName?: string;
  gender?: "Male" | "Female";
  phone?: string;
  email?: string;
  status?: string;
  followUpDate?: string;
  notes?: string;
  source?: string;
};

export async function GET(request: Request) {
  const denied = authorizeApiRequest({ request, resource: "leads", method: "GET" });
  if (denied) {
    return denied;
  }

  const session = resolvePortalSession(request);
  const url = new URL(request.url);
  const frappeScope = leadsScopeForFrappe(session);
  const frappePagination = frappePaginationParams({
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("pageSize"),
    sortBy: url.searchParams.get("sortBy"),
    sortDir: url.searchParams.get("sortDir"),
  });
  const proxied = await maybeRouteToFrappe("leads", "get", { ...frappeScope, ...frappePagination });
  if (proxied) {
    logSuccessfulApiRequest(request, "leads", "GET", 200);
    return proxied;
  }

  const allLeads = [...leads, ...getCreatedLeads()];
  const scopedLeads = filterByPermission(
    allLeads.map((lead) => ({ ...lead, country: lead.country as Country })),
    {
    ...buildPermissionContext(request),
    ...roleHeadersFromSession(session),
    },
  );

  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  // Pagination is MANDATORY — never return the full scoped table (unbounded
  // payload / OOM risk at scale). Absent params default to page 1, size 50.
  const result = paginate(scopedLeads, {
    page: pageParam ? Number(pageParam) : 1,
    pageSize: pageSizeParam ? Number(pageSizeParam) : 50,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortDir: url.searchParams.get("sortDir") === "desc" ? "desc" : "asc",
    filters: {
      status: url.searchParams.get("status") ?? "",
      country: url.searchParams.get("country") ?? "",
      priority: url.searchParams.get("priority") ?? "",
    },
  });
  return devStoreResponse(result.rows, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
    policy: "Configure FRAPPE_BASE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET to proxy ERPNext data.",
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LeadPayload;
  const objectPayload = payload as Record<string, unknown>;
  const denied = authorizeApiRequest({ request, resource: "leads", method: "POST", payload: objectPayload });
  if (denied) {
    return denied;
  }

  const validation = validateLeadPayload(payload);
  if (validation) {
    return jsonError(validation);
  }

  // §9: a lead may only be assigned to a user the caller has authority over.
  // The add-lead dropdown already constrains this in the UI; enforce it here so
  // a crafted request cannot assign a lead outside the caller's scope.
  const session = resolvePortalSession(request);
  if (!canAssignLeadTo(session.effectiveUser, payload.assignedUser)) {
    return jsonError("You can only assign this lead to a user you manage.");
  }

  // A new lead genuinely needs a starting status; updates must not (see mapLeadToFrappe).
  const createPayload = mapLeadToFrappe({ ...payload, status: payload.status ?? "New Lead (Uncontacted)" });
  const proxied = await maybeRouteToFrappe("leads", "post", createPayload);
  if (proxied) {
    logSuccessfulApiRequest(request, "leads", "POST", 201);
    return proxied;
  }

  return devStoreResponse(
    payload,
    {
      message: "Lead accepted by frontend boundary. Frappe is not configured in this environment.",
      status: 201,
    },
  );
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as LeadPayload & { id?: string };
  const objectPayload = payload as Record<string, unknown>;
  const denied = authorizeApiRequest({ request, resource: "leads", method: "PATCH", payload: objectPayload });
  if (denied) {
    return denied;
  }

  if (!payload.id) {
    return jsonError("Lead id is required for updates.");
  }

  if (payload.status) {
    const current = leads.find((lead) => lead.id === payload.id);
    if (current) {
      const transitionError = validateLeadTransition(current.status, payload.status, payload.followUpDate);
      if (transitionError) {
        return jsonError(transitionError);
      }
    } else if (payload.status === "Scheduled Follow-Up" && !payload.followUpDate) {
      return jsonError("followUpDate is required for Scheduled Follow-Up.");
    }
  } else if (payload.followUpDate !== undefined) {
    // Date-only PATCH (auto-save): no status change, but a lead already in
    // "Scheduled Follow-Up" must not lose its required follow-up date.
    const current = leads.find((lead) => lead.id === payload.id);
    if (current?.status === "Scheduled Follow-Up" && !payload.followUpDate) {
      return jsonError("followUpDate is required for Scheduled Follow-Up.");
    }
  }

  const proxied = await maybeRouteToFrappe("leads", "patch", { name: payload.id, ...mapLeadToFrappe(payload) });
  if (proxied) {
    logSuccessfulApiRequest(request, "leads", "PATCH", 200);
    return proxied;
  }

  return devStoreResponse(payload, {
    message: "Lead update accepted by frontend boundary. Frappe is not configured in this environment.",
  });
}

export async function PUT(request: Request) {
  return PATCH(request);
}

export function DELETE() {
  return deleteNotAllowed();
}

function validateLeadPayload(payload: LeadPayload) {
  const required: Array<keyof LeadPayload> = [
    "companyName",
    "country",
    "assignedUser",
    "contactFirstName",
    "contactLastName",
    "gender",
    "phone",
    "email",
  ];

  const missing = required.filter((field) => !payload[field]);
  if (missing.length) {
    return `Missing required field(s): ${missing.join(", ")}.`;
  }

  if (!(allowedCountries as readonly string[]).includes(payload.country ?? "")) {
    return "Country is not enabled for LebTech Partner Platform.";
  }

  if (payload.status && !(leadStatuses as readonly string[]).includes(payload.status)) {
    return "Unsupported lead status.";
  }

  if (payload.status === "Scheduled Follow-Up" && !payload.followUpDate) {
    return "followUpDate is required for Scheduled Follow-Up.";
  }

  return null;
}

const LEAD_FIELD_MAP: ReadonlyArray<readonly [keyof LeadPayload, string]> = [
  ["companyName", "company_name"],
  ["country", "country"],
  ["assignedUser", "assigned_user"],
  ["contactFirstName", "contact_first_name"],
  ["contactLastName", "contact_last_name"],
  ["gender", "gender"],
  ["phone", "phone"],
  ["email", "email"],
  ["status", "status"],
  ["followUpDate", "follow_up_date"],
  ["notes", "notes"],
  ["source", "source"],
];

/**
 * Map the client lead payload to Frappe field names, sending ONLY the keys the
 * caller actually provided. Never invent a `status` here — a note-save or
 * reassign PATCH omits status, and defaulting it would silently reset the
 * lead's pipeline status on the proxied Frappe write. The create-time default
 * is applied at the POST call site, where a status is genuinely expected.
 */
export function mapLeadToFrappe(payload: LeadPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [from, to] of LEAD_FIELD_MAP) {
    if (payload[from] !== undefined) {
      out[to] = payload[from];
    }
  }
  return out;
}
