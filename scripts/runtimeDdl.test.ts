import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Migration integrity (#253): production schema belongs to the checksummed
 * ledger in migrations/, applied by scripts/run-migrations.mjs before a
 * release is activated. Application code must not create or alter schema at
 * runtime.
 *
 * KNOWN_RUNTIME_DDL is a ratchet, not an approval: these modules predate the
 * migration runner and still self-provision. Each should move into a numbered
 * migration and leave this list. The test fails if a file NOT on the list
 * gains DDL, and if a listed file no longer has any (so the list only shrinks).
 */
const KNOWN_RUNTIME_DDL = new Set([
  "server/integrations/ensureDeSyncSchema.ts",
  "server/lifecycleOrchestrator.ts",
  "server/portalAuthStore.ts",
  "server/portalChatStore.ts",
  "server/portalLoginKnocksStore.ts",
  "server/portalOrg.ts",
  "server/portalSurveyStore.ts",
  "server/services/de-intelligence/storage.ts",
  "server/services/msp-advisor/persist.ts",
]);

const DDL = /\b(CREATE\s+(UNIQUE\s+)?(TABLE|INDEX|TYPE|SEQUENCE|EXTENSION)|ALTER\s+TABLE|DROP\s+(TABLE|INDEX|TYPE))\b/i;
const ROOT = path.resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx|mjs|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("runtime DDL ratchet (#253)", () => {
  const files = [...sourceFiles(path.join(ROOT, "server")), ...sourceFiles(path.join(ROOT, "shared"))];
  const withDdl = files
    .filter((file) => DDL.test(withoutComments(readFileSync(file, "utf8"))))
    .map((file) => path.relative(ROOT, file).split(path.sep).join("/"));

  it("public_solution_requests schema is created only by a migration", () => {
    expect(withDdl).not.toContain("server/publicSolutionRequestPersistence.ts");
    const migration = readFileSync(path.join(ROOT, "migrations/0003_public_solution_requests.sql"), "utf8");
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public_solution_requests/);
    for (const index of ["session_idx", "expiry_idx", "reference_idx"]) {
      expect(migration).toContain(`public_solution_requests_${index}`);
    }
  });

  it("portal_manual_records schema is created only by a migration", () => {
    expect(withDdl).not.toContain("server/portalManualRecords.ts");
    const migration = readFileSync(path.join(ROOT, "migrations/0003_portal_manual_records.sql"), "utf8");
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS portal_manual_records/);
    expect(migration).toContain("portal_manual_records_client_kind_idx");
  });

  it("no new application module issues runtime DDL", () => {
    const unexpected = withDdl.filter((file) => !KNOWN_RUNTIME_DDL.has(file));
    expect(unexpected).toEqual([]);
  });

  it("the known-runtime-DDL list only shrinks (remove entries once migrated)", () => {
    const stale = [...KNOWN_RUNTIME_DDL].filter((file) => !withDdl.includes(file));
    expect(stale).toEqual([]);
  });
});
