import { deleteNotAllowed, jsonError } from "@/lib/api-helpers";
import { devStoreResponse } from "@/lib/backend/backend-router";
import { maybeRouteToFrappe } from "@/lib/backend/backend-router";
import { buildPermissionContext, filterByPermission } from "@/lib/phase2-data";
import { allowedCountries, leads, leadStatuses, type Country } from "@/lib/sample-data";
import { resolvePortalSession, roleHeadersFromSession } from "@/lib/portal-security";
import { authorizeApiRequest, logSuccessfulApiRequest } from "@/lib/security/permissions";
import { validateLeadTransition } from "@/lib/business/lead-workflow";
import { paginate } from "@/lib/query/scoped-page";

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

  const proxied = await maybeRouteToFrappe("leads", "get");
  if (proxied) {
    logSuccessfulApiRequest(request, "leads", "GET", 200);
    return proxied;
  }

  const session = resolvePortalSession(request);
  const scopedLeads = filterByPermission(
    leads.map((lead) => ({ ...lead, country: lead.country as Country })),
    {
    ...buildPermissionContext(request),
    ...roleHeadersFromSession(session),
    },
  );

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  if (pageParam || pageSizeParam) {
    const result = paginate(scopedLeads, {
      page: pageParam ? Number(pageParam) : undefined,
      pageSize: pageSizeParam ? Number(pageSizeParam) : undefined,
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

  return devStoreResponse(scopedLeads, {
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

  const proxied = await maybeRouteToFrappe("leads", "post", mapLeadToFrappe(payload));
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

function mapLeadToFrappe(payload: LeadPayload) {
  return {
    company_name: payload.companyName,
    country: payload.country,
    assigned_user: payload.assignedUser,
    contact_first_name: payload.contactFirstName,
    contact_last_name: payload.contactLastName,
    gender: payload.gender,
    phone: payload.phone,
    email: payload.email,
    status: payload.status ?? "New Lead (Uncontacted)",
    follow_up_date: payload.followUpDate,
    notes: payload.notes,
    source: payload.source,
  };
}
