import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("MemStorage / DatabaseStorage credential hygiene (seeded-admin residual)", () => {
  it("does not embed the legacy fixed admin bcrypt hash or plaintext in storage.ts", () => {
    const source = readFileSync(path.resolve(here, "storage.ts"), "utf8");
    const legacyPlain = ["Admin", "123!"].join("");
    expect(source).not.toMatch(/\$2[aby]\$\d{2}\$/);
    expect(source).not.toContain(legacyPlain);
    expect(source).toMatch(/resolveDevPortalAdminPasswordHash/);
    expect(source).toMatch(/password: ""/);
  });

  it("does not embed remaining fixed demo user hashes in portalAuthStore.ts", () => {
    const source = readFileSync(path.resolve(here, "portalAuthStore.ts"), "utf8");
    expect(source).not.toMatch(/\$2b\$12\$N9Ys4\.kLCKht2rMjK4x0TO/);
    expect(source).not.toMatch(/\$2b\$12\$m6eyC5YfWBIG4\/beE40TxO/);
  });
});
