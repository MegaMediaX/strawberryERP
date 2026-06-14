import { describe, expect, it } from "vitest";

import { bucketFollowUp, inTab } from "@/lib/sales/bucket-followups";

const NOW = new Date(2026, 5, 14); // Jun 14, 2026

describe("bucketFollowUp (spec §13)", () => {
  it("classifies the human keyword strings", () => {
    expect(bucketFollowUp("Today, 16:30", NOW)).toBe("Today");
    expect(bucketFollowUp("Tomorrow, 10:00", NOW)).toBe("Tomorrow");
    expect(bucketFollowUp("TODAY, 1pm", NOW)).toBe("Today"); // case-insensitive
  });

  it("classifies parseable 'Mon D' dates relative to now", () => {
    expect(bucketFollowUp("Jun 10, 12:00", NOW)).toBe("Overdue"); // 4 days ago
    expect(bucketFollowUp("Jun 14, 09:00", NOW)).toBe("Today"); // same day
    expect(bucketFollowUp("Jun 15, 09:00", NOW)).toBe("Tomorrow"); // +1
    expect(bucketFollowUp("Jun 18, 09:00", NOW)).toBe("This Week"); // +4
    expect(bucketFollowUp("Jun 30, 09:00", NOW)).toBe("Unscheduled"); // +16 (> a week)
  });

  it("treats empty / unscheduled / unparseable as Unscheduled", () => {
    expect(bucketFollowUp("", NOW)).toBe("Unscheduled");
    expect(bucketFollowUp("Unscheduled", NOW)).toBe("Unscheduled");
    expect(bucketFollowUp("whenever", NOW)).toBe("Unscheduled");
    expect(bucketFollowUp("Xyz 40, 99:99", NOW)).toBe("Unscheduled");
  });
});

describe("inTab", () => {
  it("All matches every bucket", () => {
    for (const b of ["Today", "Overdue", "Tomorrow", "This Week", "Unscheduled"] as const) {
      expect(inTab(b, "All")).toBe(true);
    }
  });
  it("This Week includes Today, Tomorrow, and This Week", () => {
    expect(inTab("Today", "This Week")).toBe(true);
    expect(inTab("Tomorrow", "This Week")).toBe(true);
    expect(inTab("This Week", "This Week")).toBe(true);
    expect(inTab("Overdue", "This Week")).toBe(false);
    expect(inTab("Unscheduled", "This Week")).toBe(false);
  });
  it("exact tabs match their bucket", () => {
    expect(inTab("Overdue", "Overdue")).toBe(true);
    expect(inTab("Today", "Overdue")).toBe(false);
  });
});
