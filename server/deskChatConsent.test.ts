import { createHash } from "crypto";
import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  DESK_CHAT_CONSENT_NOTICE,
  DESK_CHAT_CONSENT_NOTICE_SHA256,
  currentDeskChatConsent,
} from "@shared/deskChatConsent";
import { currentDeskChatNoticeHash, recordAcceptedDeskChatConsent, rejectIfMissingDeskChatConsent } from "./deskChatConsent";

const handleAdvisorChat = vi.fn(async (input: { message: string; sessionId?: string }) => ({
  sessionId: input.sessionId || "session-from-advisor",
  reply: "Mock advisor reply",
}));

describe("DE Desk chat consent guard", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.set("trust proxy", true);
    app.post("/api/public/advisor/chat", async (req, res) => {
      if (rejectIfMissingDeskChatConsent(req, res)) return;
      const message = typeof req.body?.message === "string" ? req.body.message : "";
      if (!message) return res.status(400).json({ error: "message is required" });
      const result = await handleAdvisorChat({
        sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
        message,
      });
      await recordAcceptedDeskChatConsent(req, result.sessionId);
      res.json(result);
    });
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not resolve test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("hashes the current notice with SHA-256", () => {
    expect(currentDeskChatNoticeHash()).toBe(DESK_CHAT_CONSENT_NOTICE_SHA256);
    expect(createHash("sha256").update(DESK_CHAT_CONSENT_NOTICE, "utf8").digest("hex")).toBe(
      DESK_CHAT_CONSENT_NOTICE_SHA256,
    );
  });

  it("rejects a chat turn without consent and never calls the advisor", async () => {
    handleAdvisorChat.mockClear();
    const response = await fetch(`${baseUrl}/api/public/advisor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What services do you offer?" }),
    });
    expect(response.status).toBe(403);
    const data = (await response.json()) as { error: string; code: string };
    expect(data.error).toBe("CHAT_CONSENT_REQUIRED");
    expect(data.code).toBe("CHAT_CONSENT_REQUIRED");
    expect(handleAdvisorChat).not.toHaveBeenCalled();
  });

  it("rejects a stale consent version and never calls the advisor", async () => {
    handleAdvisorChat.mockClear();
    const response = await fetch(`${baseUrl}/api/public/advisor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What services do you offer?",
        consent: { ...currentDeskChatConsent(), version: "old-version" },
      }),
    });
    expect(response.status).toBe(403);
    expect(handleAdvisorChat).not.toHaveBeenCalled();
  });

  it("accepts a current consent payload, calls the advisor, and stores the consent record", async () => {
    handleAdvisorChat.mockClear();
    const sessionId = `consent-record-${Date.now()}`;
    const response = await fetch(`${baseUrl}/api/public/advisor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
      body: JSON.stringify({
        sessionId,
        message: "What services do you offer?",
        consent: currentDeskChatConsent(),
      }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { sessionId: string; reply: string };
    expect(data.sessionId).toBe(sessionId);
    expect(data.reply).toBe("Mock advisor reply");
    expect(handleAdvisorChat).toHaveBeenCalledTimes(1);
    expect(handleAdvisorChat).toHaveBeenCalledWith({ sessionId, message: "What services do you offer?" });
    const { getDeskChatRecordingConsent } = await import("./services/msp-advisor/persist");
    const recorded = await getDeskChatRecordingConsent(sessionId);
    expect(recorded).toMatchObject({
      version: currentDeskChatConsent().version,
      noticeHash: currentDeskChatConsent().noticeHash,
      ip: "203.0.113.10",
    });
    expect(recorded?.consentedAt).toEqual(expect.any(String));
  });
});
