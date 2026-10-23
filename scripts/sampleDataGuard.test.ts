import { describe, expect, it } from "vitest";
import { isExcludedFile, scanSource } from "./sampleDataGuard.mjs";

describe("sample-data guardrail", () => {
  it("flags SAMPLE badges, sample-mode copy and sample flags", () => {
    const findings = scanSource(`
export const item = { label: "Status", sample: true };
<Badge label="sample" />
<StatTile hint="sample" />
<p>Sample preview.</p>
const flag = process.env.ENABLE_SAMPLE_DATA;
const url = "/portal?sample=1";
`);
    const rules = findings.map((f: { rule: string }) => f.rule);
    expect(rules).toContain("sample-badge");
    expect(rules).toContain("sample-data-flag");
    expect(findings.length).toBeGreaterThanOrEqual(5);
  });

  it("flags mock / sample / demo data imports outside tests", () => {
    const findings = scanSource(`import { mockEvents } from "./mockEvents";\nimport { DEMO_ROWS } from "../data/demo-rows";\n`);
    expect(findings.map((f: { rule: string }) => f.rule)).toEqual([
      "sample-data-import",
      "sample-data-import",
    ]);
  });

  it("leaves clean production code alone", () => {
    const findings = scanSource(`
import { portalGet } from "@/lib/portalApi";
export function RealPage() {
  const cohortSize = 30;
  return <p>Study of {cohortSize} accounts</p>;
}
`);
    expect(findings).toEqual([]);
  });

  it("honours the per-line opt-out marker and never scans tests", () => {
    expect(scanSource(`const legacy = 1; // guardrail-off: legacy sample banner on this line`)).toEqual([]);
    expect(scanSource(`const x = 2; // sample: true`)).toHaveLength(1);
    expect(isExcludedFile("server/foo.test.ts")).toBe(true);
    expect(isExcludedFile("server/tenantFilesFakeDb.testkit.ts")).toBe(true);
    expect(isExcludedFile("server/fixtures/cytracom.fixtures.ts")).toBe(true);
    expect(isExcludedFile("client/src/pages/portal/PortalStatus.tsx")).toBe(false);
    expect(isExcludedFile("scripts/sampleDataGuard.mjs")).toBe(true);
  });
});
