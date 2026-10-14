import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESPONSE_TARGETS, formatResponseTargets } from "./responseTargets";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("ticket response targets", () => {
  it("match the public SLA page", () => {
    const sla = read("client/src/pages/legal/SLA.tsx");
    for (const t of Object.values(RESPONSE_TARGETS)) expect(sla).toContain(`>${t}</span>`);
  });

  it("are not restated with other times in the portal", () => {
    for (const f of ["client/src/pages/portal/PortalCreateTicket.tsx", "client/src/pages/portal/PortalStatus.tsx"]) {
      const src = read(f);
      expect(src).toContain("responseTargets");
      expect(src).not.toMatch(/Medium:? 24 hours|within 24 hours/);
    }
  });

  it("formats one line", () => {
    expect(formatResponseTargets()).toBe("Critical 15 minutes · High 1 hour · Medium 4 hours · Low next business day");
  });
});

describe("public NAP stays city only", () => {
  it("llms.txt carries no street address or ZIP", () => {
    const llms = read("public/llms.txt");
    expect(llms).not.toMatch(/Alma School|\b852\d\d\b/);
    expect(llms).toContain("- NAP: Chandler, AZ");
  });
});
