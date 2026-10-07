import { describe, expect, it } from "vitest";
import { announcementFromRecord, builtInAnnouncements, isSafePortalHref } from "./portalAnnouncements";

describe("self-service announcements", () => {
  it("only allows links inside the portal", () => {
    for (const ok of ["/portal/status", "/portal/requests/loaner-computer", "/portal/kb?q=security", "/portal"]) {
      expect(isSafePortalHref(ok)).toBe(true);
    }
    for (const bad of ["https://evil.example/portal", "//evil.example", "javascript:alert(1)", "/store", "/portal/../admin", "/portal/x\"onmouseover", 42]) {
      expect(isSafePortalHref(bad)).toBe(false);
    }
  });

  it("drops a staff slide that is incomplete, outside its dates or links out", () => {
    const base = { title: "Office move", body: "We move on Friday.", ctaLabel: "Details", ctaHref: "/portal/kb?q=move" };
    expect(announcementFromRecord("a", base, "2026-10-06")).toMatchObject({ title: "Office move", source: "company", art: "general" });
    expect(announcementFromRecord("a", { ...base, ctaHref: "https://phish.example" }, "2026-10-06")).toBeNull();
    expect(announcementFromRecord("a", { ...base, title: "" }, "2026-10-06")).toBeNull();
    expect(announcementFromRecord("a", { ...base, startsOn: "2026-10-07" }, "2026-10-06")).toBeNull();
    expect(announcementFromRecord("a", { ...base, endsOn: "2026-10-05" }, "2026-10-06")).toBeNull();
    expect(announcementFromRecord("a", { ...base, startsOn: "2026-10-06", endsOn: "2026-10-06" }, "2026-10-06")).not.toBeNull();
  });

  it("shows the Cybersecurity Awareness Month slide only in October, and every built-in links inside the portal", () => {
    expect(builtInAnnouncements("2026-10-06")[0].id).toBe("de-cyber-awareness");
    expect(builtInAnnouncements("2026-11-02").some((s) => s.id === "de-cyber-awareness")).toBe(false);
    for (const s of builtInAnnouncements("2026-10-06")) expect(isSafePortalHref(s.ctaHref)).toBe(true);
  });
});
