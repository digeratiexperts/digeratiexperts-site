import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFIED_CREDENTIALS } from "./credentials";
import { OWNER_CERTIFICATIONS, TEAM_OWNER } from "./teamProfile";

/**
 * The Team page reads the owner's name, role, title and certifications from
 * teamProfile.ts only, so DE fills them in one place.
 */
const team = readFileSync(path.resolve(__dirname, "../pages/about/Team.tsx"), "utf8");

describe("Team page owner config", () => {
  it("does not type the owner's name, role or title on the page", () => {
    expect(team).toContain('from "@/data/teamProfile"');
    expect(team).toContain("{TEAM_OWNER.role}");
    expect(team).toContain("{TEAM_OWNER.name}");
    expect(team).toContain("{TEAM_OWNER.title}");
    expect(team).not.toMatch(/>\s*Founder\s*</);
    expect(team).not.toContain("Joseph Petro");
  });

  it("renders no title line until DE supplies one", () => {
    expect(team).toMatch(/\{TEAM_OWNER\.title && \(/);
    expect(typeof TEAM_OWNER.title).toBe("string");
  });

  // Joe, 2026-10-14: the title is the one the live homepage publishes under the
  // same photograph, so the two cannot drift apart.
  it("matches the role line on the live homepage", () => {
    const home = readFileSync(
      path.resolve(__dirname, "../pages/versions/v8/sections/09-team.tsx"),
      "utf8",
    );
    expect(home).toContain(`${TEAM_OWNER.role} &amp; ${TEAM_OWNER.title}`);
  });

  it("publishes each owner certification through the verified credentials list, held by the owner", () => {
    for (const c of OWNER_CERTIFICATIONS) {
      expect(c.kind, c.name).toBe("certification");
      expect(c.holder, c.name).toBe(TEAM_OWNER.name);
      expect(VERIFIED_CREDENTIALS).toContain(c);
    }
  });
});
