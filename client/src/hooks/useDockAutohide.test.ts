import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCK_AUTOHIDE } from "./useDockAutohide";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("bottom bar autohide (opt-in)", () => {
  it("keeps the agreed thresholds (bar/SPEC.md in the homepage section concept)", () => {
    expect(DOCK_AUTOHIDE).toEqual({ tuck: 160, show: 32, reach: 96, reachDelay: 120, jumpHold: 900, bootHold: 1200 });
  });

  it("is off by default, so production chrome is unchanged", () => {
    const bar = read("client/src/components/SiteBottomBar.tsx");
    expect(bar).toMatch(/export function SiteBottomBar\(\{ autohide = false \}/);
    const app = read("client/src/App.tsx");
    // The sitewide bar is mounted without the prop.
    expect(app).toMatch(/<SiteBottomBar \/>/);
    expect(app).not.toMatch(/<SiteBottomBar autohide/);
    // The previous homepage (now /version-0) does not opt in.
    expect(read("client/src/pages/DigeratiHomepage.tsx")).not.toMatch(/autohide/);
  });

  it("is switched on by the homepage (Version 8) and /version-7, which own their bar", () => {
    expect(read("client/src/pages/versions/v7/HomepageV7.tsx")).toMatch(/<SiteBottomBar autohide \/>/);
    expect(read("client/src/pages/versions/v8/HomepageV8.tsx")).toMatch(/<SiteBottomBar autohide \/>/);
    const owns = read("client/src/App.tsx").match(/const ownsBottomBar = ([^;]+);/)?.[1] ?? "";
    expect(owns).toMatch(/^isHome \|\| /);
    expect(owns).toContain('location === "/version-7"');
    // / renders Version 8 (Joe, 2026-10-03); /version-8 only redirects there.
    expect(read("client/src/App.tsx")).toMatch(/<Route path="\/" component=\{\(\) => \(\s*<Suspense fallback=\{<PageLoadingSkeleton \/>\}>\s*<HomepageV8 \/>/);
    expect(owns).not.toContain('location === "/version-8"');
    // /version-0 is the previous homepage component, which never opts in.
    expect(owns).toContain('location === "/version-0"');
  });

  it("tucks the dock and back-to-top but never the Ask DE launcher", () => {
    const bar = read("client/src/components/SiteBottomBar.tsx");
    expect(bar).toMatch(/const showScrollTop = farDown && !tucked;/);
    expect(bar).toMatch(/const expanded = showMenu && !tucked;/);
    // Ask DE visibility does not depend on the autohide state.
    expect(bar).toMatch(/const showAskDE = !deskOpen;/);
  });

  it("stops publishing the bar height while it steps aside for typing", () => {
    expect(read("client/src/components/SiteBottomBar.tsx")).toMatch(/const height = typing \? "0px"/);
  });
});
