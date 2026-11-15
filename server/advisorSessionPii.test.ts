/**
 * Unauthenticated GET /api/public/advisor/session/:id must never return
 * extracted email, phone, or contact name to a caller who only has the session id.
 */
import express from "express";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import {
  appendMessage,
  createSession,
  getPublicSessionResponse,
  publicSessionView,
  updateProfile,
  _resetSessionsForTests,
} from "./services/msp-advisor/session";
import { createEmptyProfile } from "./services/msp-advisor/profile";

const EMAIL = "jane@acme.example";
const PHONE = "602-555-0199";
const NAME = "Jane Doe";

function seedSessionWithPii() {
  const session = createSession();
  updateProfile(session, {
    ...createEmptyProfile(),
    email: EMAIL,
    phone: PHONE,
    contactName: NAME,
    companyName: "Acme LLC",
    industry: "legal",
    employeeCount: 12,
  });
  appendMessage(session, "user", `I'm ${NAME}. Email me at ${EMAIL} or call ${PHONE}.`);
  return session;
}

type TestResponse = { status: number; body: any; text: string };

function sendGet(app: express.Express, path: string): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const server = createServer(app).listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          server.close();
          let parsed: any = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = {};
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, text });
        });
      });
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

/** Same unauthenticated handler shape as server/routes.ts. */
function advisorSessionApp() {
  const app = express();
  app.get("/api/public/advisor/session/:id", (req, res) => {
    try {
      const result = getPublicSessionResponse(req.params.id);
      res.status(result.status).json(result.body);
    } catch {
      res.status(500).json({ error: "Failed to load session" });
    }
  });
  return app;
}

function expectNoPii(raw: string): void {
  expect(raw).not.toMatch(/jane@acme\.example/i);
  expect(raw).not.toMatch(/602-555-0199/);
  expect(raw).not.toMatch(/Jane Doe/i);
  expect(raw).not.toMatch(/"email"\s*:/);
  expect(raw).not.toMatch(/"phone"\s*:/);
  expect(raw).not.toMatch(/"contactName"\s*:/);
}

beforeEach(() => {
  _resetSessionsForTests();
});

describe("publicSessionView PII redaction", () => {
  it("omits email, phone, and contactName and redacts them from messages", () => {
    const session = seedSessionWithPii();
    const view = publicSessionView(session);
    const raw = JSON.stringify(view);
    expect(view.sessionId).toBe(session.id);
    expect(view.profile.companyName).toBe("Acme LLC");
    expect(view.profile).not.toHaveProperty("email");
    expect(view.profile).not.toHaveProperty("phone");
    expect(view.profile).not.toHaveProperty("contactName");
    expect(view.messages[0].content).toMatch(/\[redacted\]/);
    expectNoPii(raw);
  });
});

describe("GET /api/public/advisor/session/:id", () => {
  it("does not leak PII to an unauthenticated caller who only has the session id", async () => {
    const session = seedSessionWithPii();
    const res = await sendGet(advisorSessionApp(), `/api/public/advisor/session/${session.id}`);
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(session.id);
    expect(res.body.profile.companyName).toBe("Acme LLC");
    expect(res.body.profile).not.toHaveProperty("email");
    expect(res.body.profile).not.toHaveProperty("phone");
    expect(res.body.profile).not.toHaveProperty("contactName");
    expectNoPii(res.text);
    expectNoPii(JSON.stringify(res.body));
  });

  it("returns 404 for an unknown session id", async () => {
    const res = await sendGet(advisorSessionApp(), "/api/public/advisor/session/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Session not found" });
    expectNoPii(res.text);
  });
});