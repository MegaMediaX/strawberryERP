/**
 * Deterministic synthetic dataset generator for scale testing.
 *
 * Produces the DoD scale fixture (≥10k leads, ≥5k customers) spread across the
 * enabled countries, multiple resellers, and many assigned users, with a
 * realistic status / priority / currency mix. Deterministic (seeded LCG) so test
 * runs and benchmarks are reproducible.
 */

import type { ScopedRecord } from "@/lib/query/scoped-page";

export interface SyntheticLead extends ScopedRecord {
  id: string;
  company: string;
  country: string;
  reseller: string;
  assignedUser: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface SyntheticCustomer extends ScopedRecord {
  id: string;
  company: string;
  country: string;
  reseller: string;
  assignedUser: string;
  customerStatus: string;
  currency: string;
  createdAt: string;
}

const COUNTRIES = ["Lebanon", "Cyprus", "Jordan", "Syria"];
const STATUSES = [
  "New Lead (Uncontacted)",
  "Attempted Contact (No Response)",
  "Contacted (Awaiting Response)",
  "Contacted (Not Interested)",
  "Contacted (Interested)",
  "Scheduled Follow-Up",
];
const PRIORITIES = ["Low", "Medium", "High", "VIP"];
const CUSTOMER_STATUSES = ["Contract Not Signed", "Contract Signed", "Deposit Paid", "Fully Paid"];
const CURRENCIES = ["USD", "EUR", "LBP", "JOD"];

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export interface SyntheticOptions {
  leads?: number;
  customers?: number;
  resellers?: number;
  usersPerReseller?: number;
  seed?: number;
}

export function generateDataset(opts: SyntheticOptions = {}) {
  const leadCount = opts.leads ?? 10_000;
  const customerCount = opts.customers ?? 5_000;
  const resellerCount = opts.resellers ?? 20;
  const usersPerReseller = opts.usersPerReseller ?? 5;
  const rand = lcg(opts.seed ?? 42);

  const resellers = Array.from({ length: resellerCount }, (_, i) => `Reseller ${i + 1}`);
  const usersByReseller = new Map<string, string[]>();
  for (const r of resellers) {
    usersByReseller.set(
      r,
      Array.from({ length: usersPerReseller }, (_, i) => `${r} User ${i + 1}`),
    );
  }

  const leads: SyntheticLead[] = Array.from({ length: leadCount }, (_, i) => {
    const reseller = pick(rand, resellers);
    const assignedUser = pick(rand, usersByReseller.get(reseller)!);
    return {
      id: `LEAD-${i + 1}`,
      company: `Company ${i + 1}`,
      country: pick(rand, COUNTRIES),
      reseller,
      assignedUser,
      status: pick(rand, STATUSES),
      priority: pick(rand, PRIORITIES),
      createdAt: new Date(1_700_000_000_000 + i * 60_000).toISOString(),
    };
  });

  const customers: SyntheticCustomer[] = Array.from({ length: customerCount }, (_, i) => {
    const reseller = pick(rand, resellers);
    const assignedUser = pick(rand, usersByReseller.get(reseller)!);
    return {
      id: `CUST-${i + 1}`,
      company: `Customer ${i + 1}`,
      country: pick(rand, COUNTRIES),
      reseller,
      assignedUser,
      customerStatus: pick(rand, CUSTOMER_STATUSES),
      currency: pick(rand, CURRENCIES),
      createdAt: new Date(1_700_000_000_000 + i * 120_000).toISOString(),
    };
  });

  return { leads, customers, resellers, usersByReseller };
}
