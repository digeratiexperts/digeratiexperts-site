/**
 * DE Desk secure fields on the website and in the Client Portal (#1179 slice 2).
 *
 * The value goes from the browser to the Hub once and nowhere else: never back
 * to a browser, never into a log line, never through the HTML-escaping
 * sanitiser, and never to a ticket the caller cannot see. There is no reveal
 * route on the website. Every value here is an obviously fake placeholder,
 * generated per run, and every test asserts it never leaks.
 */
import { randomBytes } from "node:crypto";
import express from "express";
import { createServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createHubTicketClient, type HubTicketClientDeps } from "./integrations/hubTicketClient";
import { signDeSyncRequest } from "./integrations/deSyncAuth";
import type { HubSecureField } from "./integrations/hubSecureFieldsContract";
import {
  PORTAL_SECURE_FIELDS_PATH,
  WIDGET_SECURE_FIELD_PATH,
  WIDGET_SECURE_FIELD_TOKEN_TTL_MS,
  issueWidgetSecureFieldToken,
  registerPortalSecureFieldRoutes,
  registerWidgetSecureFieldRoute,
  toBrowserSecureField,
  verifyWidgetSecureFieldToken,
  type SecureFieldTarget,
} from "./portalSecureFields";

// Minimal in-process HTTP helper (the repo has no supertest): starts the app
// on an ephemeral loopback port for one request, then closes it.
type TestResponse = { status: number; headers: IncomingHttpHeaders; body: any; text: string };
function send(app: express.Express, method: string, path: string, body?: unknown): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const server = createServer(app).listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpRequest({ host: "127.0.0.1", port, path, method, headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {} }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => {
          server.close();
          let parsed: any = {};
          try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = {}; }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed, text });
        });
      });
      req.on("error", (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}
function request(app: express.Express) {
  return {
    get: (path: string) => send(app, "GET", path),
    post: (path: string) => ({ send: (body: unknown) => send(app, "POST", path, body) }),
  };
}

const PLAINTEXT = `fake-placeholder-${randomBytes(8).toString("hex")}<&>"'`;
const TOKEN_SECRET = "widget-token-test-secret";
const HUB_SECRET = "portal-secure-fields-test-secret";

function meta(over: Partial<HubSecureField> = {}): HubSecureField {
  return {
    id: 7,
    ticketId: 41,
    label: "Office Wi-Fi",
    kind: "wifi",
    status: "active",
    submittedBy: { kind: "client", name: "Sam Client (client)" },
    expiresAt: "2026-11-19T15:00:00.000Z",
    expiredAt: null,
    revealCount: 0,
    lastRevealedAt: null,
    createdAt: "2026-11-12T15:00:00.000Z",
    ...over,
  };
}

type Captured = { url: string; method: string; headers: Record<string, string>; body: string };

function mockedHub(reply: { status: number; body: unknown }) {
  const calls: Captured[] = [];
  const deps: HubTicketClientDeps = {
    base: () => "https://hub.example.test/api",
    secret: () => HUB_SECRET,
    timeoutMs: 1000,
    fetch: vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body ?? "{}" });
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch,
  };
  return { client: createHubTicketClient(deps), calls };
}

const created = (field = meta()) => ({ status: 201, body: { contract: "de.hub.portal-secure-fields/v1", ticketId: field.ticketId, secureField: field } });

let logged: string[] = [];
let spies: MockInstance[] = [];
beforeEach(() => {
  logged = [];
  spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    }),
  );
});
afterEach(() => {
  for (const s of spies) s.mockRestore();
  expect(logged.join("\n")).not.toContain(PLAINTEXT);
});

function portalApp(hub: ReturnType<typeof mockedHub>["client"], target: SecureFieldTarget | null, onStored = vi.fn()) {
  const app = express();
  app.use(express.json());
  const resolveTarget = vi.fn(async (_req: any, res: any) => {
    if (!target) {
      res.status(404).json({ error: "Ticket not found" });
      return null;
    }
    return target;
  });
  registerPortalSecureFieldRoutes(app, { guards: [], hubTickets: hub, resolveTarget, onStored });
  return { app, resolveTarget, onStored };
}

const clientTarget: SecureFieldTarget = {
  tenant: { accountId: "41", portalClientId: "client-1" },
  hubTicketId: 41,
  isDeStaff: false,
  authorName: "Sam Client",
};
const path = PORTAL_SECURE_FIELDS_PATH.replace(":id", "hub-41");

describe("portal secure fields: submit", () => {
  it("hands the exact value to the Hub once, as the signed-in client, and answers metadata only", async () => {
    const hub = mockedHub(created());
    const { app, onStored } = portalApp(hub.client, clientTarget);
    const res = await request(app).post(path).send({ label: "Office Wi-Fi", kind: "wifi", secretValue: PLAINTEXT });
    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    expect(Object.keys(res.body.secureField)).not.toContain("secretValue");

    expect(hub.calls).toHaveLength(1);
    const call = hub.calls[0];
    const u = new URL(call.url);
    expect(`${u.pathname}${u.search}`).toBe("/api/webhooks/portal/tickets/41/secure-fields?accountId=41&portalClientId=client-1");
    expect(signDeSyncRequest({ method: "POST", path: `${u.pathname}${u.search}`, timestamp: call.headers["X-DE-Timestamp"], eventId: call.headers["X-DE-Event-ID"], body: call.body, secret: HUB_SECRET })).toBe(call.headers["X-DE-Signature"]);
    // Not escaped, not trimmed: the Hub stores exactly what was typed.
    expect(JSON.parse(call.body)).toEqual({ label: "Office Wi-Fi", kind: "wifi", secretValue: PLAINTEXT, submittedBy: "client", authorName: "Sam Client" });
    // The audit hook gets metadata only (arg 0 is the express request).
    expect(onStored).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onStored.mock.calls.map((c) => c[1]))).not.toContain(PLAINTEXT);
  });

  it("records portal admins as DE staff, with their own name, never a name from the body", async () => {
    const hub = mockedHub(created(meta({ submittedBy: { kind: "staff", name: "Alex (DE via Client Portal, not Hub-verified)" } })));
    const { app } = portalApp(hub.client, { ...clientTarget, isDeStaff: true, authorName: "Alex" });
    const spoof = await request(app).post(path).send({ label: "Printer admin", secretValue: PLAINTEXT, authorName: "Joseph" });
    expect(spoof.status).toBe(400);
    expect(hub.calls).toHaveLength(0);
    const res = await request(app).post(path).send({ label: "Printer admin", kind: "password", secretValue: PLAINTEXT });
    expect(res.status).toBe(201);
    expect(JSON.parse(hub.calls[0].body)).toMatchObject({ submittedBy: "de_staff", authorName: "Alex" });
  });

  it("refuses a bad body without echoing the value or calling the Hub", async () => {
    const hub = mockedHub(created());
    const { app } = portalApp(hub.client, clientTarget);
    for (const bad of [
      { label: "", secretValue: PLAINTEXT },
      { label: "Wi-Fi", secretValue: "" },
      { label: "Wi-Fi", secretValue: PLAINTEXT, kind: "credit_card" },
      { label: "Wi-Fi", secretValue: PLAINTEXT, submittedBy: "de_staff" },
      { label: "Wi-Fi", secretValue: "x".repeat(4097) },
    ]) {
      const res = await request(app).post(path).send(bad);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    }
    expect(hub.calls).toHaveLength(0);
  });

  it("never reaches the Hub for a ticket the caller cannot see", async () => {
    const hub = mockedHub(created());
    const { app } = portalApp(hub.client, null);
    const res = await request(app).post(path).send({ label: "Wi-Fi", secretValue: PLAINTEXT });
    expect(res.status).toBe(404);
    expect(hub.calls).toHaveLength(0);
  });

  it("maps Hub refusals and outages to safe answers that never carry the value", async () => {
    for (const [status, body, expected] of [
      [404, { error: "Ticket not found" }, 404],
      [409, { error: "A canonical Hub accountId is required" }, 404],
      [400, { error: "Invalid secure field", details: ["label: looks like the secret"] }, 400],
      [503, { error: "Secure fields are unavailable", code: "encryption_not_configured" }, 503],
    ] as const) {
      const hub = mockedHub({ status, body });
      const { app } = portalApp(hub.client, clientTarget);
      const res = await request(app).post(path).send({ label: "Wi-Fi", secretValue: PLAINTEXT });
      expect(res.status).toBe(expected);
      expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    }
  });
});

describe("portal secure fields: list", () => {
  it("returns metadata only, even if the Hub answered with more", async () => {
    const leaky = { ...meta(), secretValue: PLAINTEXT, valueEnc: "enc:v1:abc" };
    const hub = mockedHub({ status: 200, body: { contract: "de.hub.portal-secure-fields/v1", ticketId: 41, secureFields: [leaky] } });
    const { app } = portalApp(hub.client, clientTarget);
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.body.reveal).toBe("hub_only");
    expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    expect(JSON.stringify(res.body)).not.toContain("enc:v1");
    expect(Object.keys(res.body.secureFields[0]).sort()).toEqual(Object.keys(toBrowserSecureField(meta())).sort());
    expect(hub.calls[0].method).toBe("GET");
  });

  it("has no reveal or expire route on the website", async () => {
    const hub = mockedHub(created());
    const { app } = portalApp(hub.client, clientTarget);
    for (const suffix of ["/7/reveal", "/7/expire"]) {
      const res = await request(app).post(`${path}${suffix}`).send({ reason: "need it" });
      expect(res.status).toBe(404);
    }
    expect(hub.calls).toHaveLength(0);
  });
});

describe("website DE Desk secure field (anonymous visitor)", () => {
  function widgetApp(hub: ReturnType<typeof mockedHub>["client"]) {
    const app = express();
    app.use(express.json());
    registerWidgetSecureFieldRoute(app, { hubTickets: hub, tokenSecret: () => TOKEN_SECRET, rateLimiter: (_req, _res, next) => next() });
    return app;
  }

  it("stores the visitor's value on the ticket the token names, as a client", async () => {
    const hub = mockedHub(created());
    const token = issueWidgetSecureFieldToken({ hubTicketId: 55, accountId: null, portalClientId: null, name: "Sam Visitor" }, TOKEN_SECRET);
    const res = await request(widgetApp(hub.client)).post(WIDGET_SECURE_FIELD_PATH).send({ token, label: "Router admin", kind: "password", secretValue: PLAINTEXT });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    const u = new URL(hub.calls[0].url);
    expect(`${u.pathname}${u.search}`).toBe("/api/webhooks/portal/tickets/55/secure-fields");
    expect(JSON.parse(hub.calls[0].body)).toEqual({ label: "Router admin", kind: "password", secretValue: PLAINTEXT, submittedBy: "client", authorName: "Sam Visitor" });
  });

  it("sends the account when the visitor's email mapped to one", async () => {
    const hub = mockedHub(created());
    const token = issueWidgetSecureFieldToken({ hubTicketId: 56, accountId: "41", portalClientId: "client-1", name: null }, TOKEN_SECRET);
    await request(widgetApp(hub.client)).post(WIDGET_SECURE_FIELD_PATH).send({ token, label: "Wi-Fi", secretValue: PLAINTEXT });
    const u = new URL(hub.calls[0].url);
    expect(u.search).toBe("?accountId=41&portalClientId=client-1");
    expect(JSON.parse(hub.calls[0].body).authorName).toBe("Website visitor");
  });

  it("refuses a missing, forged, tampered or expired token without calling the Hub", async () => {
    const hub = mockedHub(created());
    const app = widgetApp(hub.client);
    const good = issueWidgetSecureFieldToken({ hubTicketId: 55, accountId: null, portalClientId: null, name: null }, TOKEN_SECRET);
    const [payload, sig] = good.split(".");
    const otherTicket = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), t: 99 })).toString("base64url");
    const expired = issueWidgetSecureFieldToken({ hubTicketId: 55, accountId: null, portalClientId: null, name: null }, TOKEN_SECRET, Date.now() - WIDGET_SECURE_FIELD_TOKEN_TTL_MS - 1000);
    const forged = issueWidgetSecureFieldToken({ hubTicketId: 55, accountId: null, portalClientId: null, name: null }, "some-other-secret");
    for (const token of ["not-a-token-at-all", `${otherTicket}.${sig}`, expired, forged]) {
      const res = await request(app).post(WIDGET_SECURE_FIELD_PATH).send({ token, label: "Wi-Fi", secretValue: PLAINTEXT });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    }
    const missing = await request(app).post(WIDGET_SECURE_FIELD_PATH).send({ label: "Wi-Fi", secretValue: PLAINTEXT });
    expect(missing.status).toBe(400);
    expect(hub.calls).toHaveLength(0);
  });

  it("round-trips a token and binds it to one ticket", () => {
    const token = issueWidgetSecureFieldToken({ hubTicketId: 12, accountId: "3", portalClientId: "c", name: "A" }, TOKEN_SECRET);
    expect(verifyWidgetSecureFieldToken(token, TOKEN_SECRET)).toEqual({ hubTicketId: 12, accountId: "3", portalClientId: "c", name: "A" });
    expect(verifyWidgetSecureFieldToken(token, "wrong")).toBeNull();
    expect(token).not.toContain(TOKEN_SECRET);
  });
});
