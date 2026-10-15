import { describe, expect, it } from "vitest";
import { publicHealthView } from "./publicHealth";

const full = {
  status: "ok",
  timestamp: "2026-10-14T00:00:00.000Z",
  version: "1.0.0",
  release: { commit: "a".repeat(40), commitShort: "aaaaaaaa", builtAt: null },
  env: "production",
  port: "3300",
  uptime: 42,
  stagingReview: { enabled: false },
  services: {
    database: "connected",
    sessionRevocation: "ready",
    zohoPayments: "configured",
    zohoDesk: "ok",
    zoho: { crm: "connected", desk: "connected", books: "unknown", payments: "not_configured" },
    openai: "configured",
    solutionSpool: { pending: 0, writable: true },
  },
};

describe("publicHealthView", () => {
  it("keeps what monitors read", () => {
    const view = publicHealthView(full);
    expect(view.status).toBe("ok");
    expect(view.services.database).toBe("connected");
    expect(view.services.zohoDesk).toBe("ok");
    expect(view.services.zoho).toEqual(full.services.zoho);
    expect(view.uptime).toBe(42);
  });

  it("drops build and configuration detail", () => {
    const json = JSON.stringify(publicHealthView(full));
    for (const key of ["release", "env", "port", "version", "stagingReview", "openai", "zohoPayments", "solutionSpool", "sessionRevocation"]) {
      expect(json).not.toContain(`"${key}"`);
    }
    expect(json).not.toContain("a".repeat(40));
  });
});
