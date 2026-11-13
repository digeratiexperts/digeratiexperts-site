import { describe, expect, it } from "vitest";
import { buildOrganizationSchema, organizationSchemaScriptTag, ORGANIZATION_ID } from "@shared/organizationSchema";
import { applyOrganizationSchema } from "./routeMeta";
import { PRIMARY_PHONE } from "@shared/companyContact";

describe("organization schema", () => {
  it("is one entity with a stable @id and the canonical phone", () => {
    const org = buildOrganizationSchema();
    expect(org["@id"]).toBe(ORGANIZATION_ID);
    expect(org.telephone).toBe(PRIMARY_PHONE.schemaTelephone);
  });

  it("lists only live social profiles in sameAs", () => {
    const sameAs = buildOrganizationSchema().sameAs as string[];
    expect(sameAs).toContain("https://x.com/DigeratiExperts");
    // 2026-11-11: LinkedIn company URL 404s and the Instagram handle has no account.
    expect(sameAs.some((u) => u.includes("linkedin.com"))).toBe(false);
    expect(sameAs.some((u) => u.includes("instagram.com"))).toBe(false);
  });

  it("is written into the HTML shell exactly once", () => {
    const shell = "<html><head><title>x</title></head><body><div id=\"root\"></div></body></html>";
    const once = applyOrganizationSchema(shell);
    const twice = applyOrganizationSchema(once);
    expect(twice.match(/data-jsonld="organization"/g)?.length).toBe(1);
    expect(once).toContain(organizationSchemaScriptTag());
  });

  it("cannot break out of its script tag", () => {
    const tag = organizationSchemaScriptTag();
    const json = tag.slice(tag.indexOf(">") + 1, -"</script>".length);
    expect(json).not.toContain("<");
    expect(JSON.parse(json)["@id"]).toBe(ORGANIZATION_ID);
  });
});
