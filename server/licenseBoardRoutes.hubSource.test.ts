import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubLicensesProjection } from "./integrations/hubLicensesContract";
import type { LicenseBoardSource } from "./licenseBoardHubSource";

/**
 * LICENSE_BOARD_SOURCE through the real licence board routes on the memory
 * store, Hub mocked. portal: the Hub is never called. shadow: the page is
 * byte-for-byte the portal's, the Hub is read in the background. hub: company
 * seats come from the Hub, per company, with the portal as fallback. Pushes
 * keep the portal's seats in every mode.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-license-board";

const ADMIN = { id: "a1", role: "admin", fullName: "DE Staffer", email: "staff@digeratiexperts.com" };
const clients = [
  { id: "c1", companyName: "Acme", hubAccountId: "41" },
  { id: "c2", companyName: "Bluebird Dental", hubAccountId: null },
];

let mode: LicenseBoardSource = "portal";
let hubReply: HubLicensesProjection | null = null;
const fetchHubLicenses = vi.fn(async (_accountId: string, _clientId: string) => hubReply);

const projection = (seats: { fromPool: number; toOrder: number }): HubLicensesProjection => ({
  contract: "de.hub.licenses/v1",
  accountId: 41,
  generatedAt: "2026-11-05T16:00:00.000Z",
  items: [
    {
      productId: 7,
      kind: "license",
      vendor: "Microsoft",
      product: "Microsoft 365 Business Premium",
      category: "Productivity",
      catalogKey: "ms_m365_bp",
      sku: null,
      chocoPackage: null,
      seats: { total: seats.fromPool + seats.toOrder, ...seats },
    },
  ],
  totals: { products: 1, seats: seats.fromPool + seats.toOrder, fromPool: seats.fromPool, toOrder: seats.toOrder },
});

describe("license board seat source", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const { registerLicenseBoardRoutes } = await import("./licenseBoardRoutes");
    const { requireAdmin } = await import("./routes");
    const app = express();
    app.use(express.json());
    const signedInAs: express.RequestHandler = (req, _res, next) => {
      (req as express.Request & { user?: unknown }).user = ADMIN;
      next();
    };
    registerLicenseBoardRoutes(app, {
      adminGuards: [signedInAs, requireAdmin],
      listClients: () => clients,
      getClient: (id) => clients.find((c) => c.id === id),
      listClientUsers: () => [],
      listDepartments: async () => [],
      jumpcloud: {
        configured: () => true,
        ensureChocoApp: async () => ({ ok: true, id: "app" }),
        associate: async () => ({ ok: true }),
        findSystem: async () => ({ ok: false, error: "none" }),
      },
      fetchHubLicenses,
      licenseBoardSource: () => mode,
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    base = `http://127.0.0.1:${address.port}/api/portal/admin/license-board`;
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const call = async (method: string, path: string, body?: object) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  let itemId = "";
  beforeEach(async () => {
    (await import("./licenseBoardStore"))._resetLicenseBoardMemory();
    mode = "portal";
    hubReply = null;
    fetchHubLicenses.mockClear();
    const { body: added } = await call("POST", "/items", { catalogKey: "ms_m365_bp", quantity: 2 });
    itemId = added.item.id;
    // Portal: Acme holds 3 seats, 2 from DE's pool and 1 to order.
    expect((await call("POST", "/allocate", { itemId, clientId: "c1", quantity: 3 })).body).toMatchObject({ fromPool: 2, toOrder: 1 });
  });

  const acme = (board: { clients: Array<{ id: string; seats: unknown[] }> }) => board.clients.find((c) => c.id === "c1")!.seats;
  const PORTAL_SEATS = () => [{ itemId, held: 3, toOrder: 1, assigned: 0, free: 3, unlimited: false }];

  it("portal (default): the Hub is never called", async () => {
    const board = await call("GET", "");
    expect(acme(board.body)).toEqual(PORTAL_SEATS());
    expect((await call("GET", "/clients/c1")).body.pool[0]).toMatchObject({ held: 3, toOrder: 1 });
    expect(fetchHubLicenses).not.toHaveBeenCalled();
  });

  it("shadow: the page is the portal's, the Hub is read in the background for mapped companies", async () => {
    const portalBoard = (await call("GET", "")).body;
    mode = "shadow";
    hubReply = projection({ fromPool: 5, toOrder: 0 });
    const shadowBoard = (await call("GET", "")).body;
    expect(shadowBoard).toEqual(portalBoard);
    await vi.waitFor(() => expect(fetchHubLicenses).toHaveBeenCalledWith("41", "c1"));
    // Bluebird has no hub_account_id: never sent to the Hub.
    expect(fetchHubLicenses.mock.calls.every(([, clientId]) => clientId === "c1")).toBe(true);
    expect((await call("GET", "/clients/c1")).body.pool[0]).toMatchObject({ held: 3, toOrder: 1 });
  });

  it("hub: company seats come from the Hub; DE's pool and the unmapped company stay on the portal", async () => {
    mode = "hub";
    hubReply = projection({ fromPool: 4, toOrder: 1 });
    const board = (await call("GET", "")).body;
    expect(acme(board)).toEqual([{ itemId, held: 5, toOrder: 1, assigned: 0, free: 5, unlimited: false }]);
    expect(board.clients.find((c: { id: string }) => c.id === "c2").seats).toEqual([]);
    expect(board.items[0]).toMatchObject({ id: itemId, quantity: 2, allocated: 2, toOrder: 1 });
    const company = (await call("GET", "/clients/c1")).body;
    expect(company.pool[0]).toMatchObject({ itemId, held: 5, toOrder: 1, vendor: "Microsoft" });
  });

  it("hub: falls back to the portal when the Hub cannot answer", async () => {
    mode = "hub";
    hubReply = null;
    expect(acme((await call("GET", "")).body)).toEqual(PORTAL_SEATS());
    expect((await call("GET", "/clients/c1")).body.pool[0]).toMatchObject({ held: 3, toOrder: 1 });
    expect(fetchHubLicenses).toHaveBeenCalled();
  });

  it("pushes keep the portal's seats in every mode (writes have not moved)", async () => {
    mode = "hub";
    hubReply = projection({ fromPool: 9, toOrder: 0 });
    expect((await call("GET", "/clients/c1/jumpcloud")).status).toBe(200);
    expect(fetchHubLicenses).not.toHaveBeenCalled();
  });
});
