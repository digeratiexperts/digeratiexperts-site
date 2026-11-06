import { z } from "zod";

/**
 * Hub licence entitlements, read by the portal licence board.
 *
 * Contract `de.hub.licenses/v1`, Hub route GET /api/webhooks/portal/licenses
 * (Intelligence-Hub artifacts/api-server/src/routes/portal-licenses.ts). The
 * shape is pinned field by field in deSyncContract.fixture.json →
 * reads.portalLicenses, a copy of the Hub fixture block; both sides' parity
 * tests fail if either moves first.
 *
 * One account's seats only. `productId` is the Hub's own product id, not a
 * portal pool item id; the board matches the two by product identity
 * (server/licenseBoardHubSource.ts). Plan: Intelligence-Hub
 * docs/architecture/portal-reads-hub-plan.md, area 1.
 */

export const HUB_LICENSES_CONTRACT = "de.hub.licenses/v1" as const;
export const HUB_LICENSES_PATH = "/api/webhooks/portal/licenses" as const;

const count = z.number().int().nonnegative();

export const hubLicenseItemSchema = z.object({
  productId: z.number().int(),
  kind: z.enum(["license", "app"]),
  vendor: z.string(),
  product: z.string(),
  category: z.string(),
  catalogKey: z.string().nullable(),
  sku: z.string().nullable(),
  chocoPackage: z.string().nullable(),
  seats: z.object({ total: count, fromPool: count, toOrder: count }),
});

export const hubLicensesProjectionSchema = z.object({
  contract: z.literal(HUB_LICENSES_CONTRACT),
  accountId: z.number().int(),
  generatedAt: z.string(),
  items: z.array(hubLicenseItemSchema),
  totals: z.object({ products: count, seats: count, fromPool: count, toOrder: count }),
});

export type HubLicenseItem = z.infer<typeof hubLicenseItemSchema>;
export type HubLicensesProjection = z.infer<typeof hubLicensesProjectionSchema>;
