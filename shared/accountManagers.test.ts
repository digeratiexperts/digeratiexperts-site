import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MANAGERS,
  DEFAULT_ACCOUNT_MANAGER_ID,
  accountTeamFor,
  isAccountManagerId,
  resolveAccountManager,
} from "./accountManagers";
import fs from "node:fs";
import path from "node:path";

describe("account managers", () => {
  it("has unique ids and a default that exists", () => {
    const ids = ACCOUNT_MANAGERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_ACCOUNT_MANAGER_ID);
  });

  it("ships every profile photo", () => {
    for (const m of ACCOUNT_MANAGERS) {
      for (const p of [m.photo.jpg, m.photo.webp]) {
        expect(fs.existsSync(path.join("client/public", p))).toBe(true);
      }
    }
  });

  it("falls back to the default for empty or unknown assignments", () => {
    expect(resolveAccountManager(null).id).toBe(DEFAULT_ACCOUNT_MANAGER_ID);
    expect(resolveAccountManager("nobody").id).toBe(DEFAULT_ACCOUNT_MANAGER_ID);
    expect(isAccountManagerId("nobody")).toBe(false);
    expect(isAccountManagerId(DEFAULT_ACCOUNT_MANAGER_ID)).toBe(true);
  });

  it("pairs the manager with the sales department", () => {
    const team = accountTeamFor(undefined);
    expect(team.sales.email).toBe("sales@digerati-experts.com");
    expect(team.manager.name).toBe("Joseph Petro");
  });
});
