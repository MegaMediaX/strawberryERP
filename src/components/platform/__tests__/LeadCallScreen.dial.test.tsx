// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeadCallScreen } from "@/components/platform/LeadCallScreen";
import type { PortalLead } from "@/lib/ui-data";

/**
 * TC5 — LeadCallScreen telephonyMode gating + the CRM dial-button's
 * component-side DIAL-R1 cooldown guard. WebrtcCallButton is mocked to a
 * minimal stub (it has its own full lifecycle test file); next/navigation's
 * useRouter is mocked since there's no real App Router in a component test.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/platform/WebrtcCallButton", () => ({
  WebrtcCallButton: ({ number }: { number: string }) => (
    <div data-testid="webrtc-call-button-stub">Softphone for {number}</div>
  ),
}));

function lead(overrides: Partial<PortalLead> = {}): PortalLead {
  return {
    id: "LEAD-1",
    company: "Acme LLC",
    contact: "Jane Doe",
    gender: "Female",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "Marven El Mouallem",
    phone: "01350000",
    email: "jane@example.com",
    priority: "Medium",
    status: "New Lead (Uncontacted)",
    followUp: "",
    source: "Website",
    notes: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "simulated",
        live: false,
        note: "Simulated — live dialing is off (TELEPHONY_LIVE_DIAL). No call was placed.",
      }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LeadCallScreen — telephonyMode gating", () => {
  it("telephonyMode='webrtc' renders the WebrtcCallButton softphone, not the CRM dial button", () => {
    render(<LeadCallScreen lead={lead()} telephonyMode="webrtc" />);
    expect(screen.getByTestId("webrtc-call-button-stub")).toBeTruthy();
    expect(screen.getByText(/Softphone for 01350000/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Call via CRM" })).toBeNull();
  });

  it("telephonyMode='tinyphone' (default) renders 'Call via CRM', not the softphone", () => {
    render(<LeadCallScreen lead={lead()} telephonyMode="tinyphone" />);
    expect(screen.getByRole("button", { name: "Call via CRM" })).toBeTruthy();
    expect(screen.queryByTestId("webrtc-call-button-stub")).toBeNull();
  });
});

describe("LeadCallScreen — CRM dial button DIAL-R1 cooldown guard", () => {
  it("disables the button while the dial request is in flight ('Calling…')", () => {
    render(<LeadCallScreen lead={lead()} telephonyMode="tinyphone" />);
    const btn = screen.getByRole("button", { name: "Call via CRM" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    // dialBusy flips synchronously (before the mocked fetch promise resolves).
    expect(screen.getByRole("button", { name: "Calling…" })).toBeTruthy();
  });

  it("renders the honest simulated note from the mocked 202 dial response and keeps the button disabled during the post-request cooldown (DIAL-R1)", async () => {
    render(<LeadCallScreen lead={lead()} telephonyMode="tinyphone" />);
    fireEvent.click(screen.getByRole("button", { name: "Call via CRM" }));
    await screen.findByText(/Simulated — live dialing is off \(TELEPHONY_LIVE_DIAL\)\. No call was placed\./);
    // dialBusy has cleared (button label reverts) but dialCooldown still disables it.
    const btn = screen.getByRole("button", { name: "Call via CRM" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("a rapid second click while busy does not fire a second fetch call", async () => {
    render(<LeadCallScreen lead={lead()} telephonyMode="tinyphone" />);
    const btn = screen.getByRole("button", { name: "Call via CRM" });
    fireEvent.click(btn);
    // Button is now disabled (dialBusy) — a second click on a disabled button
    // is a no-op in the DOM/React Testing Library, mirroring real browser behavior.
    fireEvent.click(screen.getByRole("button", { name: "Calling…" }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
