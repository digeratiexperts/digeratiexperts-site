import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "PortalBilling.tsx"), "utf8");

describe("Portal billing auto-renew terms typography", () => {
  it("shows subscription terms and cancel copy at body size with full-contrast text", () => {
    expect(source).toContain('data-testid="hub-subscription-terms"');
    expect(source).toContain("whitespace-pre-wrap text-base text-foreground");
    expect(source).toContain('AlertDialogDescription className="text-base text-foreground"');
    expect(source).not.toContain("whitespace-pre-wrap text-sm text-muted-foreground");
  });
});
