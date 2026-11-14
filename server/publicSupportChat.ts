import { randomBytes } from "crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { generateChatResponse } from "./openaiService";
import { deskTopicRedirectReply, isOffTopicCompanionRequest } from "@shared/deskTopicScope";
import { DE_KNOWLEDGE_CATALOG } from "./services/de-intelligence/catalog";

export type PublicChatHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ENTRIES = 12;

export function sanitizeConversationHistory(value: unknown): PublicChatHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY_ENTRIES)
    .flatMap((entry): PublicChatHistoryEntry[] => {
      if (!entry || typeof entry !== "object") return [];

      const role = (entry as { role?: unknown }).role;
      const rawContent = (entry as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof rawContent !== "string") {
        return [];
      }

      const content = rawContent.trim().slice(0, MAX_MESSAGE_LENGTH);
      return content ? [{ role, content }] : [];
    });
}

function assistantConfigured(): boolean {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API ||
    (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY)
  );
}

const publicSupportChatRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many chat messages. Please wait a few minutes or create a support ticket.",
  },
});

export function registerPublicSupportChat(app: Express): void {
  app.get("/api/portal/zoho/chat/status", (_req, res) => {
    const publicKnowledgeRecords = DE_KNOWLEDGE_CATALOG.filter(
      (record) => record.scope === "public" && record.status === "active",
    ).length;

    res.json({
      success: true,
      assistantAvailable: assistantConfigured(),
      mode: "ai-assistant",
      ticketFallback: "/api/portal/zoho/ticket",
      intelligence: {
        enabled: true,
        version: "de-intelligence-v1",
        publicGovernedRecords: publicKnowledgeRecords,
      },
    });
  });

  app.post("/api/portal/zoho/chat", publicSupportChatRateLimiter, async (req, res) => {
    try {
      const rawMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (!rawMessage) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (rawMessage.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
          error: `Message must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer`,
        });
      }

      const conversationHistory = sanitizeConversationHistory(req.body?.conversationHistory);
      // Crisis checks run first, before topic scope. When #1024 lands, call
      // isCrisisMessage(rawMessage) here and return the fixed crisis reply
      // before the topic-scope guard or the model. Do not move the
      // topic-scope guard above that check.
      if (isOffTopicCompanionRequest(rawMessage)) {
        const previous = [...conversationHistory].reverse().find((entry) => entry.role === "assistant")?.content ?? null;
        return res.json({
          success: true,
          message: {
            id: `support-${Date.now()}-topic`,
            content: deskTopicRedirectReply(previous),
            respondedBy: "ai",
            timestamp: new Date().toISOString(),
          },
        });
      }
      const content = await generateChatResponse(rawMessage, conversationHistory);

      return res.json({
        success: true,
        message: {
          id: `support-${Date.now()}-${randomBytes(4).toString("hex")}`,
          content,
          respondedBy: "ai",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("[PUBLIC SUPPORT CHAT ERROR]", error?.message || error);
      return res.status(500).json({
        error: "The support assistant is temporarily unavailable. Please create a support ticket instead.",
      });
    }
  });
}
