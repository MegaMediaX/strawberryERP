import { beforeEach, describe, expect, it } from "vitest";

import { PATCH as STATUS } from "@/app/api/admin/slots/status/route";
import { getDevStore, setSlotStatus } from "@/lib/dev-store";

/**
 * §P4 regression: approval appends a draft invoice line, so a slot LEAVING
 * Reserved must take that line with it — otherwise the reseller keeps being
 * billed for a slot they no longer hold.
 *
 * Two actions leave Reserved: `release` (→Available) and `setInactive`
 * (→Inactive). `reject` never does — it is only valid from OnHold, i.e. before
 * approval has created any line.
 *
 * B3 is seeded Available + active + priced 900 in "Hall B", and no other slot
 * test in this file touches it.
 */
const SLOT = "B3";
const PRICE = 900;
const RESELLER = "Beirut Digital Partners";
const DRAFT_ID = "SLOT-DRAFT-BEIRUT-DIGITAL-PARTNERS";
const LINE = `Slot ${SLOT}`;

function statusRequest(body: unknown) {
  return STATUS(
    new Request("https://portal.local/api/admin/slots/status", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-platform-user-id": "USR-SUPER" },
      body: JSON.stringify(body),
    }),
  );
}

const draft = () => getDevStore().invoices.find((i) => i.id === DRAFT_ID);
const draftHasSlotLine = () => Boolean(draft()?.lineItems.some((l) => l.description === LINE));

/** Put the slot OnHold as of NOW, so normalizeExpiredHolds can't expire it mid-test. */
function arrangeOnHold() {
  setSlotStatus(SLOT, { status: "OnHold", heldBy: RESELLER, heldAt: new Date().toISOString() });
}

describe("PATCH /api/admin/slots/status — draft invoice line lifecycle (§P4)", () => {
  beforeEach(() => {
    // The dev-store is a module singleton shared across tests in this file, and a
    // test that ends Reserved leaves its line behind — the next approve would then
    // append a SECOND identical line and skew the totals assertions. Start clean.
    const store = getDevStore();
    store.invoices = store.invoices.filter((i) => i.id !== DRAFT_ID);
    arrangeOnHold();
  });

  it("approve appends the slot's draft line", async () => {
    const res = await statusRequest({ label: SLOT, action: "approve" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { draftInvoice?: string; status: { status: string } } };
    expect(body.data.status.status).toBe("Reserved");
    expect(body.data.draftInvoice).toBe(DRAFT_ID);

    const line = draft()?.lineItems.find((l) => l.description === LINE);
    expect(line).toMatchObject({ description: LINE, quantity: 1, unitPrice: PRICE });
  });

  it("release removes the line it created and recomputes totals", async () => {
    await statusRequest({ label: SLOT, action: "approve" });
    expect(draftHasSlotLine()).toBe(true);
    const before = draft()!.total;

    const res = await statusRequest({ label: SLOT, action: "release" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { removedInvoiceLine: boolean; status: { status: string } } };
    expect(body.data.status.status).toBe("Available");
    expect(body.data.removedInvoiceLine).toBe(true);

    expect(draftHasSlotLine()).toBe(false);
    // Totals must follow the lines, not go stale.
    expect(draft()!.total).toBe(before - PRICE);
  });

  // The path the original report missed: setInactive is valid FROM Reserved too.
  it("setInactive on a Reserved slot also removes the line", async () => {
    await statusRequest({ label: SLOT, action: "approve" });
    expect(draftHasSlotLine()).toBe(true);

    const res = await statusRequest({ label: SLOT, action: "setInactive" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { removedInvoiceLine: boolean; status: { status: string } } };
    expect(body.data.status.status).toBe("Inactive");
    expect(body.data.removedInvoiceLine).toBe(true);
    expect(draftHasSlotLine()).toBe(false);
  });

  it("reject touches no invoice (no line exists before approval)", async () => {
    const invoiceCountBefore = getDevStore().invoices.length;

    const res = await statusRequest({ label: SLOT, action: "reject" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { removedInvoiceLine: boolean; status: { status: string } } };
    expect(body.data.status.status).toBe("Available");
    expect(body.data.removedInvoiceLine).toBe(false);
    expect(getDevStore().invoices.length).toBe(invoiceCountBefore);
    expect(draftHasSlotLine()).toBe(false);
  });

  it("approve → release → approve does not leave a duplicate line", async () => {
    await statusRequest({ label: SLOT, action: "approve" });
    await statusRequest({ label: SLOT, action: "release" });
    arrangeOnHold();
    await statusRequest({ label: SLOT, action: "approve" });

    const lines = draft()!.lineItems.filter((l) => l.description === LINE);
    expect(lines).toHaveLength(1);
  });
});

describe("PATCH /api/admin/slots/status — issued invoices are never edited", () => {
  const ISSUED_ID = "SLOT-ISSUED-TEST";

  it("leaves a non-Draft invoice's lines intact when the slot is released", async () => {
    const store = getDevStore();
    const template = store.invoices[0];
    // An ALREADY-ISSUED invoice that happens to carry this slot's line: removing
    // from it would silently rewrite billed history, which is worse than the orphan.
    store.invoices = [
      { ...template, id: ISSUED_ID, invoiceStatus: "Issued", reseller: RESELLER, lineItems: [{ description: LINE, quantity: 1, unitPrice: PRICE }] },
      ...store.invoices,
    ];
    setSlotStatus(SLOT, { status: "Reserved", heldBy: RESELLER, heldAt: new Date().toISOString(), reservedInvoice: ISSUED_ID, approvedBy: "Super Admin" });

    const res = await statusRequest({ label: SLOT, action: "release" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { removedInvoiceLine: boolean } };
    expect(body.data.removedInvoiceLine).toBe(false);

    const issued = getDevStore().invoices.find((i) => i.id === ISSUED_ID);
    expect(issued?.lineItems).toHaveLength(1);
    expect(issued?.lineItems[0].description).toBe(LINE);
  });

  it("leaves the seeded customer invoice untouched when its slot is released", async () => {
    // A3 is seeded Reserved against the real customer invoice INV-2026-LB-0041.
    const before = getDevStore().invoices.find((i) => i.id === "INV-2026-LB-0041");
    const linesBefore = before!.lineItems.length;
    const totalBefore = before!.total;

    const res = await statusRequest({ label: "A3", action: "release" });
    expect(res.status).toBe(200);

    const after = getDevStore().invoices.find((i) => i.id === "INV-2026-LB-0041");
    expect(after!.lineItems).toHaveLength(linesBefore);
    expect(after!.total).toBe(totalBefore);
  });
});
