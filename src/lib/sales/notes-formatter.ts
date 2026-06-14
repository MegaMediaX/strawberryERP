/**
 * Fast notes (spec §11). Pure helpers for formatting + composing the lead notes
 * string. Latest-first ordering. Timestamp is passed in (not read from a clock)
 * so the functions stay pure and unit-testable.
 */

export const noteTemplates: readonly string[] = [
  "No answer",
  "Asked to call tomorrow",
  "Requested invoice",
  "Interested but needs approval",
  "Wrong number",
];

/** A single note line: "<iso> · <author>: <text>". */
export function formatNoteLine(text: string, author: string, isoTimestamp: string): string {
  return `${isoTimestamp} · ${author}: ${text.trim()}`;
}

/** Prepend a new note line so the latest note is first. */
export function prependNote(existing: string, line: string): string {
  const prev = existing.trim();
  return prev ? `${line}\n${prev}` : line;
}

/** Split the notes string into individual lines (latest first), dropping blanks. */
export function parseNotes(notes: string): string[] {
  return notes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
