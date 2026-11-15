import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import {
  createSession,
  appendMessage,
  updateProfile,
  publicSessionView,
  getPublicSessionResponse,
  _resetSessionsForTests,
} from "./session";
import { createEmptyProfile } from "./profile";

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
  appendMessage(
    session,
    "user",
    `I'm ${NAME}. Email me at ${EMAIL} or call ${PHONE}.`,
  );
  return session;
}

function assertNoPii(raw: string): void {
  assert.doesNotMatch(raw, /jane@acme\.example/i);
  assert.doesNotMatch(raw, /602-555-0199/);
  assert.doesNotMatch(raw, /Jane Doe/i);
  assert.doesNotMatch(raw, /"email"\s*:/);
  assert.doesNotMatch(raw, /"phone"\s*:/);
  assert.doesNotMatch(raw, /"contactName"\s*:/);
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

beforeEach(() => {
  _resetSessionsForTests();
});

describe("publicSessionView", () => {
  it("omits email, phone, and contactName and redacts them from messages", () => {
    const session = seedSessionWithPii();
    const view = publicSessionView(session);
    const raw = JSON.stringify(view);
    assert.equal(view.sessionId, session.id);
    assert.equal(view.lastMode, session.lastMode);
    assert.equal(view.profile.companyName, "Acme LLC");
    assert.equal(view.profile.industry, "legal");
    assert.equal(view.profile.employeeCount, 12);
    assert.equal("email" in view.profile, false);
    assert.equal("phone" in view.profile, false);
    assert.equal("contactName" in view.profile, false);
    assert.ok(view.messages.length === 1);
    assert.equal(view.messages[0].role, "user");
    assert.match(view.messages[0].content, /\[redacted\]/);
    assertNoPii(raw);
  });
});

describe("GET /api/public/advisor/session/:id", () => {
  it("does not leak PII to an unauthenticated caller who only has the session id", async () => {
    const session = seedSessionWithPii();
    const res = await sendGet(advisorSessionApp(), `/api/public/advisor/session/${session.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.sessionId, session.id);
    assert.equal(res.body.profile.companyName, "Acme LLC");
    assert.equal("email" in (res.body.profile || {}), false);
    assert.equal("phone" in (res.body.profile || {}), false);
    assert.equal("contactName" in (res.body.profile || {}), false);
    assertNoPii(res.text);
    assertNoPii(JSON.stringify(res.body));
  });

  it("returns 404 for an unknown session id without leaking anything", async () => {
    const res = await sendGet(advisorSessionApp(), "/api/public/advisor/session/does-not-exist");
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: "Session not found" });
    assertNoPii(res.text);
  });
});