import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAddressCache, registerAddressLookupRoutes, suggestAddresses, toSuggestion } from "./addressLookup";

const GEOAPIFY_RESULT = {
  housenumber: "1600",
  street: "West Example Road",
  city: "Phoenix",
  state: "Arizona",
  state_code: "AZ",
  postcode: "85000",
  country_code: "us",
  formatted: "1600 West Example Road, Phoenix, AZ 85000, United States of America",
};

function geoapify(results: unknown[], status = 200) {
  return vi.fn(async () => new Response(JSON.stringify({ results }), { status, headers: { "Content-Type": "application/json" } }));
}

async function call(app: express.Express, path: string) {
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

afterEach(() => clearAddressCache());

describe("toSuggestion", () => {
  it("maps a Geoapify result into form fields with a US state code", () => {
    expect(toSuggestion(GEOAPIFY_RESULT)).toEqual({
      label: "1600 West Example Road, Phoenix, AZ 85000",
      line1: "1600 West Example Road",
      city: "Phoenix",
      state: "AZ",
      stateName: "Arizona",
      postalCode: "85000",
      country: "US",
      hasHouseNumber: true,
    });
  });

  it("flags street-only matches and drops results with no street", () => {
    expect(toSuggestion({ street: "West Example Road", country_code: "us" })?.hasHouseNumber).toBe(false);
    expect(toSuggestion({ city: "Phoenix" })).toBeNull();
  });
});

describe("suggestAddresses", () => {
  it("filters by country, keeps the key server-side and caches answers", async () => {
    const fetchImpl = geoapify([GEOAPIFY_RESULT, GEOAPIFY_RESULT]);
    const first = await suggestAddresses("1600 w example", "us", "secret-key", fetchImpl);
    expect(first).toHaveLength(1); // duplicate label removed
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("filter")).toBe("countrycode:us");
    expect(url.searchParams.get("text")).toBe("1600 w example");
    await suggestAddresses("1600 W EXAMPLE", "us", "secret-key", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/address/suggest", () => {
  it("reports disabled without a key, so forms stay plain inputs", async () => {
    const app = express();
    registerAddressLookupRoutes(app, { apiKey: () => undefined });
    const { body } = await call(app, "/api/address/suggest?q=1600+w+example");
    expect(body).toEqual({ enabled: false, suggestions: [] });
  });

  it("ignores short queries without calling the vendor", async () => {
    const fetchImpl = geoapify([GEOAPIFY_RESULT]);
    const app = express();
    registerAddressLookupRoutes(app, { apiKey: () => "k", fetchImpl });
    const { body } = await call(app, "/api/address/suggest?q=47");
    expect(body.suggestions).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns suggestions, and hides vendor failures", async () => {
    const app = express();
    registerAddressLookupRoutes(app, { apiKey: () => "k", fetchImpl: geoapify([GEOAPIFY_RESULT]) });
    const ok = await call(app, "/api/address/suggest?q=1600+w+example&country=US");
    expect(ok.body.suggestions[0].line1).toBe("1600 West Example Road");

    clearAddressCache();
    const broken = express();
    registerAddressLookupRoutes(broken, { apiKey: () => "k", fetchImpl: geoapify([], 401) });
    const failed = await call(broken, "/api/address/suggest?q=1600+w+example");
    expect(failed.status).toBe(200);
    expect(failed.body).toEqual({ enabled: true, suggestions: [], unavailable: true });
    expect(JSON.stringify(failed.body)).not.toContain("k&");
  });
});
