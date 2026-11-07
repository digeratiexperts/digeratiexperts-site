/**
 * Guard (issue #974): every Zoho API token comes from the one Zoho Connect
 * grant through server/zoho/oauth. This scans the website's source (not its
 * tests) and fails when:
 *  - Zoho's token path appears anywhere but server/zoho/oauth/token-endpoint.ts,
 *    the single helper that calls it (the portal sign-in's authorization_code
 *    exchange goes through that helper too);
 *  - any legacy Self Client refresh-token or per-product client setting is
 *    named again (the fallbacks removed in #974);
 *  - a Zoho file outside server/zoho/oauth builds an OAuth grant body itself.
 *    One named exception: server/portalZohoAuth.ts, the portal's person
 *    sign-in (OIDC authorization_code, its own sign-in client, no API token
 *    kept), which builds its exchange body but sends it through
 *    callZohoTokenEndpoint.
 * Docs: docs/ZOHO-OAUTH-INVENTORY.md, "Rules for every agent and person".
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const SCANNED_DIRS = ["server", "shared", "scripts", "client/src"];
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|sh)$/;
const SKIPPED_DIRS = new Set(["node_modules", "dist", "build", ".git"]);

/** Test files and test fixtures may name what production code must not. */
function isTestFile(path: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(path) || path.includes("/oauth/testing/");
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIPPED_DIRS.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (SOURCE.test(name)) out.push(relative(ROOT, full).split("\\").join("/"));
    }
  };
  for (const d of SCANNED_DIRS) walk(join(ROOT, d));
  return out.filter((f) => !isTestFile(f));
}

const TOKEN_ENDPOINT_FILE = "server/zoho/oauth/token-endpoint.ts";
const TOKEN_PATH = /\/oauth\/v2\/token/;
const LEGACY_SETTINGS =
  /\bZOHO_(?:REFRESH_TOKEN|FORM_OAUTH|(?:DESK|BOOKS|PAYMENTS)_REFRESH_TOKEN|(?:DESK|BOOKS|PAYMENTS)_CLIENT_(?:ID|SECRET))\b/;
/** Person sign-in, not an API token: see the header. */
const SIGN_IN_EXCEPTION = "server/portalZohoAuth.ts";
const GRANT_BODY =/grant_type["']?\s*[:=,]\s*["'](?:refresh_token|authorization_code)/;

function offenders(pattern: RegExp, allowed: (file: string, text: string) => boolean): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles()) {
    const text = readFileSync(join(ROOT, file), "utf8");
    if (allowed(file, text)) continue;
    text.split("\n").forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

describe("Zoho tokens come only from server/zoho/oauth (issue #974)", () => {
  it("lets the portal sign-in exchange its code only through callZohoTokenEndpoint", () => {
    const text = readFileSync(join(ROOT, SIGN_IN_EXCEPTION), "utf8");
    expect(text).toContain("callZohoTokenEndpoint(");
    expect(text).not.toMatch(/\bfetch\(\s*TOKEN/);
  });

  it("scans a real tree", () => {
    const files = sourceFiles();
    expect(files).toContain(TOKEN_ENDPOINT_FILE);
    expect(files).toContain("server/portalZohoAuth.ts");
    expect(files.length).toBeGreaterThan(100);
  });

  it("calls Zoho's token path from token-endpoint.ts only", () => {
    expect(offenders(TOKEN_PATH, (file) => file === TOKEN_ENDPOINT_FILE)).toEqual([]);
  });

  it("names no legacy Self Client refresh token or per-product client setting", () => {
    expect(offenders(LEGACY_SETTINGS, () => false)).toEqual([]);
  });

  it("builds Zoho OAuth grant bodies only inside server/zoho/oauth", () => {
    expect(
      offenders(
        GRANT_BODY,
        (file, text) => file.startsWith("server/zoho/oauth/") || file === SIGN_IN_EXCEPTION || !/zoho/i.test(text),
      ),
    ).toEqual([]);
  });
});
