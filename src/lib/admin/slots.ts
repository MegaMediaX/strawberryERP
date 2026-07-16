/**
 * Slot catalog (Exhibition Floor Plan, P1). Pure + unit-testable + client-safe
 * (no phase2-data import). Slots are labeled <Letter><Number>: A1..A6 … Z1..Z6,
 * with `slotsPerLetter` configurable by the Super Admin (default 6).
 */

import type { BusinessCalendar } from "@/lib/admin/business-hours";

/** Super-Admin slot configuration (catalog size, active set, prices, calendar). */
export interface SlotConfig {
  slotsPerLetter: number;
  activeSlots: string[];
  priceBySlot: Record<string, number>;
  currency: string;
  calendar: BusinessCalendar;
  /** Venue floor-plan image the map renders behind the booths. Booth x/y are
   * normalized (0-1) over this image when set. Empty = abstract zone-grid map. */
  floorImageUrl?: string;
}

/** A slot's position on the floor-plan canvas (P2 editor authors this). */
export interface SlotLayoutEntry {
  zoneId: string;
  x: number;
  y: number;
}

export interface SlotZone {
  id: string;
  name: string;
  order: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SLOT_RE = /^([A-Z])([1-9][0-9]*)$/;

export const DEFAULT_SLOTS_PER_LETTER = 6;

/** Generate the full ordered catalog: A1..A<n>, B1..B<n>, … Z1..Z<n>. */
export function generateSlotCatalog(slotsPerLetter: number = DEFAULT_SLOTS_PER_LETTER): string[] {
  const n = Math.max(1, Math.min(99, Math.floor(slotsPerLetter)));
  const out: string[] = [];
  for (const letter of LETTERS) {
    for (let i = 1; i <= n; i++) out.push(`${letter}${i}`);
  }
  return out;
}

export interface ParsedSlot {
  letter: string;
  number: number;
}

export function parseSlot(label: string): ParsedSlot | null {
  const m = SLOT_RE.exec((label ?? "").trim().toUpperCase());
  if (!m) return null;
  return { letter: m[1], number: Number(m[2]) };
}

export function buildSlot(letter: string, number: number): string {
  return `${letter.toUpperCase()}${number}`;
}

/** Valid label AND within the configured slots-per-letter range. */
export function isValidSlotLabel(label: string, slotsPerLetter: number = DEFAULT_SLOTS_PER_LETTER): boolean {
  const parsed = parseSlot(label);
  if (!parsed) return false;
  return parsed.number >= 1 && parsed.number <= slotsPerLetter;
}

/** Group a flat list of labels into per-letter rows (for palette/map rendering). */
export function groupSlotsByLetter(labels: readonly string[]): { letter: string; slots: string[] }[] {
  const map = new Map<string, string[]>();
  for (const label of labels) {
    const p = parseSlot(label);
    if (!p) continue;
    const row = map.get(p.letter) ?? [];
    row.push(label);
    map.set(p.letter, row);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, slots]) => ({ letter, slots: slots.sort((x, y) => (parseSlot(x)!.number - parseSlot(y)!.number)) }));
}
