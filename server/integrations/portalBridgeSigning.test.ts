/**
 * Portal-bridge calls to the Hub must be signed over pathname + search (the Hub
 * reads the tenant from the query string) and must never send the raw sync
 * token in Authorization / x-de-sync-token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
import {
  fetchHubCompanyDocuments,
  fetchHubCompanyOrders,
  fetchHubContractDownload,
} from "./techSalesClient";

const SECRET = "portal-bridge-fixture-secret";

type Captured = { url: string; headers: Record<string, string> };

describe("portal bridge signing", () => {
  let calls: Captured[];

  beforeEach(() => {
    calls = [];
    process.env.TECHSALES_HUB_URL = "https://hub.example.test/api";
    process.env.PORTAL_TO_HUB_SECRET = SECRET;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string> });
        return new Response(JSON.stringify({ documents: [], orders: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TECHSALES_HUB_URL;
    delete process.env.PORTAL_TO_HUB_SECRET;
  });

  function expectSignedOverPathAndQuery(call: Captured) {
    const parsed = new URL(call.url);
    expect(parsed.search).not.toBe("");
    expect(call.headers).not.toHaveProperty("Authorization");
    expect(call.headers).not.toHaveProperty("x-de-sync-token");
    expect(JSON.stringify(call.headers)).not.toContain(SECRET);
    expect(call.headers["X-DE-Source"]).toBe("portal");
    const expected = signDeSyncRequest({
      method: "GET",
      path: `${parsed.pathname}${parsed.search}`,
      timestamp: call.headers["X-DE-Timestamp"],
      eventId: call.headers["X-DE-Event-ID"],
      body: "{}",
      secret: SECRET,
    });
    expect(call.headers["X-DE-Signature"]).toBe(expected);
  }

  it("signs company documents, orders and contract downloads over pathname + search", async () => {
    await fetchHubCompanyDocuments("Acme Co", "42", "client-1");
    await fetchHubCompanyOrders("Acme Co", "42", "client-1");
    await fetchHubContractDownload(7, "Acme Co", "signed_pdf", "42", "client-1");

    expect(calls).toHaveLength(3);
    expect(calls[0].url).toContain("/api/webhooks/portal/company-documents?");
    expect(calls[1].url).toContain("/api/webhooks/portal/company-orders?");
    expect(calls[2].url).toContain("/api/webhooks/portal/company-documents/7/download?");
    for (const call of calls) expectSignedOverPathAndQuery(call);
    expect(calls[0].headers.Accept).toBe("application/json");
    expect(calls[1].headers.Accept).toBe("application/json");
  });

  it("binds the tenant: the signature for one accountId does not verify another", async () => {
    await fetchHubCompanyDocuments("Acme Co", "42");
    const call = calls[0];
    const other = new URL(call.url.replace("accountId=42", "accountId=43"));
    const forged = signDeSyncRequest({
      method: "GET",
      path: `${other.pathname}${other.search}`,
      timestamp: call.headers["X-DE-Timestamp"],
      eventId: call.headers["X-DE-Event-ID"],
      body: "{}",
      secret: SECRET,
    });
    expect(call.headers["X-DE-Signature"]).not.toBe(forged);
  });
});
