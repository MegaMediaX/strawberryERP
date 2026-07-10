// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesCallingQueue } from "@/components/sales/SalesCallingQueue";
import type { PortalLead } from "@/lib/ui-data";

/**
 * TC2 — SalesCallingQueue queue state machine (spec §5/§6). LeadCallScreen is
 * mocked to a minimal stub that just prints the lead id + a remount counter,
 * so this suite proves the QUEUE'S behavior (progress, skip/next, completion,
 * start-over, per-lead remount) without dragging in LeadCallScreen's own
 * fetch/telephony/notes machinery — that component gets its own test file.
 */
let leadCallScreenMounts = 0;
vi.mock("@/components/platform/LeadCallScreen", () => ({
  LeadCallScreen: ({ lead }: { lead: PortalLead }) => {
    leadCallScreenMounts += 1;
    return <div data-testid="lead-call-screen">Screen for {lead.id} (mount #{leadCallScreenMounts})</div>;
  },
}));

afterEach(() => {
  cleanup();
  leadCallScreenMounts = 0;
});

function makeLead(id: string): PortalLead {
  return {
    id,
    company: `Company ${id}`,
    contact: `Contact ${id}`,
    gender: "Other",
    country: "Lebanon",
    reseller: "Beirut Digital Partners",
    assignedTo: "Marven El Mouallem",
    phone: "01350000",
    email: `${id.toLowerCase()}@example.com`,
    priority: "Medium",
    status: "New Lead (Uncontacted)",
    followUp: "",
    source: "Website",
    notes: "",
  };
}

const actingUser = { id: "USR-SALES-MARVEN", role: "Sales Team User" as const, countries: ["Lebanon"], reseller: "Beirut Digital Partners" };

describe("SalesCallingQueue — empty state", () => {
  it("shows the empty-state card and no lead screen when there are no leads", () => {
    render(<SalesCallingQueue leads={[]} actingUser={actingUser} />);
    expect(screen.getByText(/No leads to call right now/i)).toBeTruthy();
    expect(screen.queryByTestId("lead-call-screen")).toBeNull();
  });
});

describe("SalesCallingQueue — progress + navigation", () => {
  it("shows 'N of M' progress and renders the first lead", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2"), makeLead("LEAD-3")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    expect(screen.getByText("Lead Queue Progress: 1 of 3")).toBeTruthy();
    expect(screen.getByText(/Screen for LEAD-1/)).toBeTruthy();
  });

  it("Skip advances to the next lead and updates progress", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2"), makeLead("LEAD-3")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Lead Queue Progress: 2 of 3")).toBeTruthy();
    expect(screen.getByText(/Screen for LEAD-2/)).toBeTruthy();
  });

  it("'Next lead →' advances the same way as Skip", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Next lead →" }));
    expect(screen.getByText("Lead Queue Progress: 2 of 2")).toBeTruthy();
    expect(screen.getByText(/Screen for LEAD-2/)).toBeTruthy();
  });

  it("the last lead's action button reads 'Finish' instead of 'Next lead →'", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("button", { name: "Finish" })).toBeTruthy();
  });

  it("finishing the last lead shows 'Queue complete' and hides the lead screen", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" })); // → LEAD-2, last
    fireEvent.click(screen.getByRole("button", { name: "Finish" })); // → done
    expect(screen.getByText("Queue complete")).toBeTruthy();
    expect(screen.queryByTestId("lead-call-screen")).toBeNull();
  });
});

describe("SalesCallingQueue — start over", () => {
  it("'Start over' resets the queue to index 0 and clears the complete state", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Queue complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText("Lead Queue Progress: 1 of 2")).toBeTruthy();
    expect(screen.getByText(/Screen for LEAD-1/)).toBeTruthy();
  });
});

describe("SalesCallingQueue — key={lead.id} remount contract", () => {
  it("remounts a fresh LeadCallScreen instance for each lead (no stale per-lead state carried over)", () => {
    const leads = [makeLead("LEAD-1"), makeLead("LEAD-2")];
    render(<SalesCallingQueue leads={leads} actingUser={actingUser} />);
    // First mount for LEAD-1.
    expect(screen.getByText(/Screen for LEAD-1 \(mount #1\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    // A DIFFERENT React key (lead.id) forces LeadCallScreen to unmount + remount
    // rather than update in place — mount count increments to #2 for LEAD-2.
    expect(screen.getByText(/Screen for LEAD-2 \(mount #2\)/)).toBeTruthy();
  });
});
