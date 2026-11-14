import { withOpenAIGuard } from "./openai-config";
import { getOpenAI } from "../openaiService";

export type ChatMode = "human" | "ai" | "hybrid";
export type ChatTone = "professional" | "friendly" | "technical";

export interface ChatResponse {
  messageId: string;
  content: string;
  mode: ChatMode;
  respondedBy: "user" | "ai" | "human";
  tone: ChatTone;
  confidence?: number;
  timestamp: string;
  suggestedFollowUp?: string;
}

export interface ChatContext {
  clientId: string;
  ticketId?: string;
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: ChatTone;
  mode?: ChatMode;
}

/**
 * Generate AI response for chat.
 * Uses OpenAI when configured; otherwise returns null so the caller escalates to a human.
 */
export async function generateAIChatResponse(
  userMessage: string,
  context: ChatContext,
  tone: ChatTone = "professional"
): Promise<ChatResponse | null> {
  let aiResponse: {
    content: string;
    confidence: number;
    suggestedFollowUp?: string;
  } | null = null;

  try {
    aiResponse = await withOpenAIGuard(async () => {
      const client = getOpenAI();
      if (!client) {
        return null;
      }

      const systemPrompt = buildSystemPrompt(context, tone);
      const history = buildMessageHistory(userMessage, context);

      const result = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
        max_tokens: 400,
        temperature: 0.4,
      });

      const content = result.choices[0]?.message?.content?.trim();
      if (!content) {
        return null;
      }

      return {
        content,
        confidence: 0.85,
        suggestedFollowUp: generateFollowUp(userMessage),
      };
    });
  } catch (error) {
    console.error("[hybrid-chat] OpenAI chat failed:", error);
    return null;
  }

  if (!aiResponse) {
    return null;
  }

  return {
    messageId: `msg-${Math.random().toString(36).substring(7)}`,
    content: aiResponse.content,
    mode: "ai",
    respondedBy: "ai",
    tone,
    confidence: aiResponse.confidence,
    timestamp: new Date().toISOString(),
    suggestedFollowUp: aiResponse.suggestedFollowUp,
  };
}

/**
 * Determine if response should be handled by AI or escalated to human
 */
export function shouldEscalateToHuman(
  userMessage: string,
  context?: ChatContext
): boolean {
  const text = userMessage.toLowerCase();

  // Escalate if message contains escalation keywords
  const escalationKeywords = [
    "urgent",
    "emergency",
    "human",
    "manager",
    "supervisor",
    "complaint",
    "unhappy",
    "frustrated",
    "refund",
    "billing issue",
    "critical",
  ];

  if (escalationKeywords.some((kw) => text.includes(kw))) {
    return true;
  }

  // Escalate if message is too complex (long or technical)
  if (userMessage.length > 500) {
    return true;
  }

  // Escalate if it contains code or technical patterns
  if (text.includes("error") || text.includes("crash") || text.includes("exception")) {
    return true;
  }

  return false;
}

/**
 * Route message to appropriate handler
 */
export async function routeMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse | null> {
  // Check if should escalate immediately
  if (shouldEscalateToHuman(userMessage, context)) {
    return null; // Signal to escalate to human
  }

  // Try AI response first
  const tone = context.tone || "professional";
  const aiResponse = await generateAIChatResponse(userMessage, context, tone);

  if (aiResponse) {
    return aiResponse;
  }

  // If AI disabled or failed, return null to escalate to human
  return null;
}

/**
 * Build system prompt for OpenAI
 */
function buildSystemPrompt(context: ChatContext, tone: ChatTone): string {
  const toneInstructions: Record<ChatTone, string> = {
    professional:
      "Respond in a professional, business-appropriate manner. Keep responses concise and action-oriented.",
    friendly:
      "Respond in a warm, approachable manner. Use conversational language while remaining helpful.",
    technical:
      "Respond with technical accuracy and detail. Assume the user has technical knowledge. Include relevant technical terms.",
  };

  return `You are a helpful support assistant for Digerati Experts MSP portal. 
${toneInstructions[tone]}
- Be concise and clear
- Provide actionable solutions
- If you don't know, say so and suggest escalation to human support
- Always be professional and respectful`;
}

/**
 * Build message history for OpenAI context
 */
function buildMessageHistory(
  userMessage: string,
  context: ChatContext
): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add previous messages for context
  if (context.previousMessages) {
    messages.push(...context.previousMessages.slice(-5)); // Last 5 messages for context
  }

  // Add current message
  messages.push({ role: "user", content: userMessage });

  return messages;
}

/**
 * Generate follow-up suggestion
 */
function generateFollowUp(userMessage: string): string | undefined {
  const text = userMessage.toLowerCase();

  if (text.includes("password")) {
    return "Would you like me to send you a password reset link?";
  }

  if (text.includes("track")) {
    return "Do you have a tracking number I can help you look up?";
  }

  if (text.includes("help")) {
    return "Is there anything else I can help you with today?";
  }

  return undefined;
}

/**
 * Assess message sentiment for AI confidence
 */
export function assessSentiment(message: string): "positive" | "neutral" | "negative" {
  const text = message.toLowerCase();

  const negativeWords = ["bad", "poor", "awful", "terrible", "hate", "angry", "upset", "frustrated"];
  const positiveWords = ["great", "excellent", "thank", "appreciate", "love", "happy", "perfect"];

  const negativeCount = negativeWords.filter((w) => text.includes(w)).length;
  const positiveCount = positiveWords.filter((w) => text.includes(w)).length;

  if (negativeCount > positiveCount) return "negative";
  if (positiveCount > negativeCount) return "positive";
  return "neutral";
}

/**
 * Determine priority for human review
 */
export function getPriorityForHumanReview(
  userMessage: string,
  sentiment: "positive" | "neutral" | "negative"
): "low" | "medium" | "high" {
  if (sentiment === "negative" || shouldEscalateToHuman(userMessage)) {
    return "high";
  }

  if (userMessage.length > 300) {
    return "medium";
  }

  return "low";
}
