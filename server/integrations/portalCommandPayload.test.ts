import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../portalAuthStore", () => ({
  getClient: (id: string | null | undefined) =>
    id === "client-1"
      ? {
          id: "client-1",
          companyName: "Acme Dental",
          serviceType: "managed",
          status: "active",
          hubAccountId: "42",
        }
      : undefined,
  listUniqueUsers: () => [
    { id: "user-1", role: "client", clientId: "client-1", isActive: true },
  ],
}));

vi.mock("./ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));

import { listOutbox, resetDeSyncMemory } from "./deSyncStore";
import { registerDeSyncRoutes, sessionScopedPortalPayload } from "./deSyncRoutes";

type Handler = (req: any, res: any, next: () => void) => unknown;

function portalCommandRoute(): Handler[] {
  const routes = new Map<string, Handler[]>();
  const add = (path: string, ...handlers: unknown[]) => {
    routes.set(path, (handlers.flat() as Handler[]));
  };
  const app = { get: add, post: add, put: add, patch: add, delete: add, use: () => undefined };
  const auth: Handler = (_req, _res, next) => next();
  registerDeSyncRoutes(app as any, auth as any);
  const handlers = routes.get("/api/portal/integrations/commands");
  if (!handlers) throw new Error("portal command route not registered");
  return handlers;
}

async function post(body: unknown) {
  const req: any = { body, user: { role: "client", clientId: "client-1" }, userId: "user-1" };
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const handlers = portalCommandRoute();
  let i = 0;
  const next = async (): Promise<void> => {
    const h = handlers[i++];
    if (h) await h(req, res, next as any);
  };
  await next();
  return res;
}

describe("sessionScopedPortalPayload", () => {
  it("drops every account id the browser supplies, in any spelling", () => {
    const payload = sessionScopedPortalPayload(
      {
        accountId: 999,
        account_id: "999",
        canonicalAccountId: "999",
        canonical_account_id: "999",
        hubAccountId: "999",
        "hub-account-id": "999",
        zohoAccountId: "zoho-999",
        AccountID: "999",
        note: "keep me",
      },
      { portalClientId: "client-1", actorUserId: "user-1" },
    );
    expect(payload).toEqual({ note: "keep me", portalClientId: "client-1", actorUserId: "user-1" });
  });

  it("overwrites browser-supplied portal client and actor with the session's", () => {
    const payload = sessionScopedPortalPayload(
      { portalClientId: "other-client", actorUserId: "someone-else" },
      { portalClientId: "client-1", actorUserId: "user-1" },
    );
    expect(payload.portalClientId).toBe("client-1");
    expect(payload.actorUserId).toBe("user-1");
  });
});

describe("POST /api/portal/integrations/commands", () => {
  beforeEach(() => {
    resetDeSyncMemory();
    delete process.env.DATABASE_URL;
  });

  it("never queues a browser-supplied accountId; the account comes from the session", async () => {
    const res = await post({
      eventType: "approval.submitted",
      entityType: "approval",
      payload: { accountId: 999, canonical_account_id: "999", action: "approve" },
    });
    expect(res.statusCode).toBe(202);
    const pending = await listOutbox("pending");
    expect(pending).toHaveLength(1);
    const [envelope] = pending;
    expect(envelope.canonicalAccountId).toBe("42");
    expect(envelope.payload).not.toHaveProperty("accountId");
    expect(envelope.payload).not.toHaveProperty("canonical_account_id");
    expect(envelope.payload).toMatchObject({
      action: "approve",
      portalClientId: "client-1",
      actorUserId: "user-1",
    });
  });
});
