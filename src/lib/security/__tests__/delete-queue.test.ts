import { describe, expect, it } from "vitest";

import { enqueueDelete, getDevStore, resolveDeleteQueue } from "@/lib/dev-store";

/**
 * Soft-delete / Pending Delete Queue invariant — CLAUDE_HANDOFF.md §9 / §18:
 * operational deletion creates a Pending Delete Queue record (it never hard
 * deletes), and resolution only transitions status.
 */

function sampleRequest(entityId: string) {
  return {
    entityType: "Partner Lead",
    entityId,
    label: `Lead ${entityId}`,
    requestedBy: "Reseller Admin",
    reason: "duplicate",
  };
}

describe("enqueueDelete", () => {
  it("creates a Pending record instead of deleting", () => {
    const before = getDevStore().deleteQueue.length;
    const queued = enqueueDelete(sampleRequest("LEAD-9001"));
    expect(queued.status).toBe("Pending");
    expect(queued.id).toMatch(/^DEL-/);
    expect(queued.requestedAt).toBeTruthy();
    expect(getDevStore().deleteQueue.length).toBe(before + 1);
    expect(getDevStore().deleteQueue.find((r) => r.id === queued.id)).toBeDefined();
  });
});

describe("resolveDeleteQueue", () => {
  it("transitions a queued record to Restored with a resolvedAt", () => {
    const queued = enqueueDelete(sampleRequest("LEAD-9002"));
    const resolved = resolveDeleteQueue(queued.id, "Restored");
    expect(resolved?.status).toBe("Restored");
    expect(resolved?.resolvedAt).toBeTruthy();
  });

  it("supports Permanently Deleted and Cleared terminal states", () => {
    const a = enqueueDelete(sampleRequest("LEAD-9003"));
    expect(resolveDeleteQueue(a.id, "Permanently Deleted")?.status).toBe("Permanently Deleted");
    const b = enqueueDelete(sampleRequest("LEAD-9004"));
    expect(resolveDeleteQueue(b.id, "Cleared")?.status).toBe("Cleared");
  });

  it("returns undefined for an unknown id and changes nothing", () => {
    const before = getDevStore().deleteQueue.length;
    expect(resolveDeleteQueue("DEL-nonexistent", "Restored")).toBeUndefined();
    expect(getDevStore().deleteQueue.length).toBe(before);
  });
});
