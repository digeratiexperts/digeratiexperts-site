import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Issue 395 (#378 residual): two portal flows answer with a redirect, not
 * JSON, so they cannot use the 503 helper. When the durable write fails they
 * must say it was temporary, not that the link or the sign-in itself failed.
 */

const routes = readFileSync(resolve(__dirname, "routes.ts"), "utf8");

function catchAfter(marker: string): string {
  const start = routes.indexOf(marker);
  expect(start, marker).toBeGreaterThan(-1);
  const catchAt = routes.indexOf("} catch (error: any) {", start);
  return routes.slice(catchAt, catchAt + 900);
}

describe("redirect flows report a failed save as temporary", () => {
  it("email verification keeps the link usable and says to retry", () => {
    const block = catchAfter('logSecurityEvent("EMAIL_VERIFIED"');
    const persistence = block.indexOf("error instanceof PortalPersistenceError");
    const generic = block.indexOf("verification_failed");
    expect(persistence).toBeGreaterThan(-1);
    expect(persistence).toBeLessThan(generic);
    expect(block).toMatch(/error=verification_unavailable/);
    expect(block).toMatch(/Your link still works/);
  });

  it("Zoho sign-in says to retry when the portal account could not be saved", () => {
    const block = catchAfter("const user = await resolveOrProvisionZohoPortalUser(profile, req);");
    const persistence = block.indexOf("error instanceof PortalPersistenceError");
    const generic = block.indexOf('"zoho_failed"');
    expect(persistence).toBeGreaterThan(-1);
    expect(persistence).toBeLessThan(generic);
    expect(block).toMatch(/"zoho_unavailable"/);
  });
});
