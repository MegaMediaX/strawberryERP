import { describe, expect, it } from "vitest";

import {
  buildCustomerRows,
  customerRollup,
  type ContractLike,
  type CustomerLike,
  type InvoiceLike,
  type ReceiptLike,
} from "@/lib/reseller/customer-rollup";

const cust: CustomerLike = { id: "C1", name: "Cedar Cloud Services", country: "Lebanon", reseller: "Beirut Digital Partners" };
const contracts: ContractLike[] = [{ customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", contractStatus: "Signed" }];
const inv = (total: number): InvoiceLike => ({ customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", total });
const rcpt = (amount: number): ReceiptLike => ({ customer: "Cedar Cloud Services", reseller: "Beirut Digital Partners", amount });

describe("customerRollup (spec §15/§16)", () => {
  it("derives balance + invoice status + progress for a partially-paid signed customer", () => {
    const r = customerRollup(cust, contracts, [inv(8000)], [rcpt(2500)]);
    expect(r.invoiceTotal).toBe(8000);
    expect(r.paidTotal).toBe(2500);
    expect(r.balance).toBe(5500);
    expect(r.invoiceStatus).toBe("Partially Paid");
    expect(r.progress).toBe("Deposit Paid");
  });

  it("marks fully paid when receipts cover invoices", () => {
    const r = customerRollup(cust, contracts, [inv(5000)], [rcpt(5000)]);
    expect(r.balance).toBe(0);
    expect(r.invoiceStatus).toBe("Fully Paid");
    expect(r.progress).toBe("Fully Paid");
  });

  it("is 'Contract Not Signed' when no signed contract, regardless of payment", () => {
    const r = customerRollup(cust, [], [inv(1000)], []);
    expect(r.contractStatus).toBe("Not Signed");
    expect(r.progress).toBe("Contract Not Signed");
    expect(r.invoiceStatus).toBe("Unpaid");
  });

  it("is 'Contract Signed' with no invoices, and 'No invoices' status", () => {
    const r = customerRollup(cust, contracts, [], []);
    expect(r.invoiceStatus).toBe("No invoices");
    expect(r.progress).toBe("Contract Signed");
  });

  it("does not mix another reseller's billing into the rollup", () => {
    const r = customerRollup(cust, contracts, [inv(8000), { customer: "Cedar Cloud Services", reseller: "Other", total: 9999 }], []);
    expect(r.invoiceTotal).toBe(8000); // the 'Other' reseller invoice is excluded
  });

  it("buildCustomerRows maps every customer", () => {
    const rows = buildCustomerRows([cust, { ...cust, id: "C2", name: "Beta" }], contracts, [inv(8000)], [rcpt(2500)]);
    expect(rows).toHaveLength(2);
    expect(rows[1].invoiceStatus).toBe("No invoices");
  });
});
