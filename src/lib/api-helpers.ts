import { NextResponse } from "next/server";

export const deleteForbiddenBody = {
  ok: false,
  error: {
    code: "METHOD_NOT_ALLOWED",
    message: "Delete access is not allowed through API.",
  },
};

export function deleteNotAllowed() {
  return NextResponse.json(deleteForbiddenBody, {
    status: 405,
    headers: {
      Allow: "GET, POST, PATCH",
    },
  });
}

export function jsonError(error: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: code ?? errorCodeForStatus(status, error),
        message: error,
      },
    },
    { status },
  );
}

export function sampleSource(data: unknown, extra?: Record<string, unknown>) {
  return NextResponse.json({
    ok: true,
    source: "sample-data",
    data,
    ...extra,
  });
}

function errorCodeForStatus(status: number, message: string) {
  const normalized = message.toLowerCase();
  if (status === 401) {
    return "UNAUTHENTICATED";
  }
  if (status === 403 || normalized.includes("permission") || normalized.includes("access denied")) {
    return "PERMISSION_DENIED";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 405) {
    return "METHOD_NOT_ALLOWED";
  }
  if (normalized.includes("country")) {
    return "BLOCKED_COUNTRY";
  }
  if (normalized.includes("scope")) {
    return "MISSING_SCOPE";
  }
  if (normalized.includes("frappe")) {
    return "FRAPPE_CONNECTION_ERROR";
  }
  return "VALIDATION_ERROR";
}
