import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("MemStorage / DatabaseStorage credential hygiene (seeded-admin residual)", () => {
  it("does not embed the legacy fixed admin bcrypt hash or plaintext in storage.ts", () => {
    const source = readFileSync(path.resolve(here, "storage.ts"), "utf8");
    const legacyHash = ["$2b$12$Bf.sDD1gQ6391SrTebkd4", ".9BeiteKKOswHl63vyCN0/51CmDldT7K"].join(
      "",
    );
    const legacyAdmin10 = ["$2b$10$GI4G0Wfv.JGucTnjjcLH6", "ebHF2FRZVCXF6DeWlaEK7OWZRranaeTm"].join(
      "",
    );
    const legacyPlain = ["Admin", "123!"].join("");
    expect(source).not.toContain(legacyHash);
    expect(source).not.toContain(legacyAdmin10);
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
