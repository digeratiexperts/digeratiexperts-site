import { describe, expect, it } from "vitest";
import {
  isDemoClientPricingEnabled,
  listDemoClientPricing,
  resolveAuthenticatedStoreClient,
  resolveClientPricingRowsFromSources,
  resolveUnitPrice,
  StoreClientPricingUnavailableError,
  toPriceOverrides,
} from "./storeClientPricing";

describe("store client pricing", () => {
  it("applies only a verified discount below catalog list price", () => {
    expect(resolveUnitPrice(39, 30)).toBe(30);
    expect(resolveUnitPrice(39, 39)).toBe(39);
    expect(resolveUnitPrice(39, 40)).toBe(39);
    expect(resolveUnitPrice(39, 0)).toBe(39);
    expect(resolveUnitPrice(39, undefined)).toBe(39);
  });

  it("maps demo rows to product overrides without trusting missing prices", () => {
    const overrides = toPriceOverrides(listDemoClientPricing("client-1"));
    expect(overrides["prod-010"]).toBe(35);
    expect(overrides["missing"]).toBeUndefined();
  });

  it("fails closed when production pricing storage is unavailable", async () => {
    await expect(
      resolveClientPricingRowsFromSources("client-1", {
        environment: {
          NODE_ENV: "production",
          PORTAL_ENABLE_DEMO_DATA: "true",
        },
        databaseAvailable: false,
        loadDatabaseRows: async () => [],
      }),
    ).rejects.toBeInstanceOf(StoreClientPricingUnavailableError);
  });

  it("fails closed when a production pricing query errors", async () => {
    await expect(
      resolveClientPricingRowsFromSources("client-1", {
        environment: { NODE_ENV: "production" },
        databaseAvailable: true,
        loadDatabaseRows: async () => {
          throw new Error("database offline");
        },
      }),
    ).rejects.toBeInstanceOf(StoreClientPricingUnavailableError);
  });

  it("uses demo pricing only behind the explicit nonproduction demo flag", async () => {
    const loadDatabaseRows = async () => [];

    await expect(
      resolveClientPricingRowsFromSources("client-1", {
        environment: { NODE_ENV: "development" },
        databaseAvailable: false,
        loadDatabaseRows,
      }),
    ).resolves.toEqual([]);

    await expect(
      resolveClientPricingRowsFromSources("client-1", {
        environment: {
          NODE_ENV: "development",
          PORTAL_ENABLE_DEMO_DATA: "true",
        },
        databaseAvailable: false,
        loadDatabaseRows,
      }),
    ).resolves.toEqual(listDemoClientPricing("client-1"));
  });

  it("enables demo pricing administration only for an explicit nonproduction flag", () => {
    expect(isDemoClientPricingEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      isDemoClientPricingEnabled({
        NODE_ENV: "development",
        PORTAL_ENABLE_DEMO_DATA: " true ",
      }),
    ).toBe(true);
    expect(
      isDemoClientPricingEnabled({
        NODE_ENV: "production",
        PORTAL_ENABLE_DEMO_DATA: "true",
      }),
    ).toBe(false);
  });

  it("resolves the store tenant from the authenticated client id", async () => {
    const requestedClientIds: string[] = [];
    const client = await resolveAuthenticatedStoreClient(
      { clientId: "client-live" },
      async (clientId) => {
        requestedClientIds.push(clientId);
        return {
          id: clientId,
          companyName: "Live Company",
          serviceType: "managed",
        };
      },
    );

    expect(requestedClientIds).toEqual(["client-live"]);
    expect(client?.id).toBe("client-live");
  });

  it("rejects a durable client record that does not match the authenticated tenant", async () => {
    await expect(
      resolveAuthenticatedStoreClient(
        { clientId: "client-live" },
        async () => ({
          id: "client-other",
          companyName: "Other Company",
          serviceType: "comanaged",
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
