import { describe, expect, it } from "vitest";
import { absoluteOgImageForPath, ROUTE_OG_IMAGES } from "./routeOgImages";

describe("route OG stills (B-5)", () => {
  it("maps the seven branded routes to /images/og/*.png", () => {
    expect(ROUTE_OG_IMAGES["/"]).toBe("/images/og/home.png");
    expect(ROUTE_OG_IMAGES["/about/team"]).toBe("/images/og/about-team.png");
    expect(ROUTE_OG_IMAGES["/store"]).toBe("/images/og/store.png");
    expect(ROUTE_OG_IMAGES["/resources/blog"]).toBe("/images/og/blog.png");
    expect(ROUTE_OG_IMAGES["/portal/login"]).toBe("/images/og/portal-login.png");
    expect(ROUTE_OG_IMAGES["/portal/dashboard"]).toBe("/images/og/portal-dashboard.png");
  });

  it("returns an absolute og:image URL and strips a trailing slash", () => {
    expect(absoluteOgImageForPath("/about/team/")).toBe(
      "https://digeratiexperts.com/images/og/about-team.png",
    );
    expect(absoluteOgImageForPath("/resources/case-studies")).toBeUndefined();
  });
});
