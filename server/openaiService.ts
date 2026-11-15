import OpenAI from "openai";
import { createHash } from "crypto";
import { DESK_TOPIC_SCOPE_RULE } from "@shared/deskTopicScope";

let openaiClient: OpenAI | null = null;

export function initOpenAI(): OpenAI | null {
  if (openaiClient) return openaiClient;

  // Prefer AI Integrations proxy when both base URL + key are set; else standard OpenAI.
  const integrationsBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const integrationsKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const directKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;

  const apiKey = integrationsKey || directKey;
  if (!apiKey) {
    console.log("⚠️ OpenAI not configured (set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_*) — AI features disabled");
    return null;
  }

  try {
    openaiClient = new OpenAI(
      integrationsBase && integrationsKey
        ? { baseURL: integrationsBase, apiKey: integrationsKey }
        : { apiKey },
    );
    console.log("✅ OpenAI client initialized");
    return openaiClient;
  } catch (error) {
    console.error("Failed to initialize OpenAI:", error);
    return null;
  }
}

export function getOpenAI(): OpenAI | null {
  return openaiClient || initOpenAI();
}

export async function classifyTicket(title: string, description: string): Promise<{
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  suggestedTags: string[];
}> {
  const client = getOpenAI();
  
  if (!client) {
    return {
      category: "General",
      priority: "medium",
      suggestedTags: [],
    };
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a support ticket classifier for an MSP (Managed Service Provider). 
Analyze the ticket and return JSON with:
- category: one of "Network", "Hardware", "Software", "Security", "Email", "Cloud", "General"
- priority: one of "low", "medium", "high", "critical" based on urgency
- suggestedTags: array of relevant tags

Respond only with valid JSON.`
        },
        {
          role: "user",
          content: `Title: ${title}\nDescription: ${description}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error("AI classification failed:", error);
    return {
      category: "General",
      priority: "medium",
      suggestedTags: [],
    };
  }
}

export async function generateChatResponse(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const client = getOpenAI();
  
  if (!client) {
    return "I'm sorry, the AI assistant is currently unavailable. Please contact support directly or create a support ticket.";
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful IT support assistant for Digerati Experts, an MSP company. 
You help clients with technical questions, troubleshooting, and service inquiries.
Be professional, concise, and helpful. If you cannot resolve an issue, suggest creating a support ticket.
For billing or account-specific questions, direct users to their account manager.
${DESK_TOPIC_SCOPE_RULE}`
        },
        ...conversationHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })),
        { role: "user" as const, content: userMessage }
      ],
      max_tokens: 500,
    });
    
    return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI chat failed:", error);
    return "I'm experiencing technical difficulties. Please try again or contact support directly.";
  }
}

export async function summarizeTicket(
  ticketHistory: string
): Promise<string> {
  const client = getOpenAI();
  
  if (!client) {
    return "Summary unavailable - AI service not configured.";
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Summarize the following support ticket history in 2-3 concise sentences, highlighting the main issue and current status."
        },
        { role: "user", content: ticketHistory }
      ],
      max_tokens: 150,
    });
    
    return response.choices[0]?.message?.content || "Unable to generate summary.";
  } catch (error) {
    console.error("AI summary failed:", error);
    return "Summary generation failed.";
  }
}

export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const VALID_VOICES: OpenAIVoice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const MAX_CHUNK = 4000;

// In-memory LRU cache for blog TTS (static article text → repeat listens).
interface CacheEntry {
  key: string;
  buffer: Buffer;
  bytes: number;
}
const ttsCache = new Map<string, CacheEntry>();
let ttsCacheBytes = 0;
const TTS_CACHE_MAX_BYTES = 64 * 1024 * 1024;

function ttsCacheKey(text: string, voice: OpenAIVoice): string {
  return createHash("sha1").update(`${voice}:${text}`).digest("hex");
}

function ttsCacheGet(key: string): Buffer | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  ttsCache.delete(key);
  ttsCache.set(key, entry);
  return entry.buffer;
}

function ttsCacheSet(key: string, buffer: Buffer): void {
  const bytes = buffer.length;
  if (bytes > TTS_CACHE_MAX_BYTES) return;
  ttsCache.set(key, { key, buffer, bytes });
  ttsCacheBytes += bytes;
  while (ttsCacheBytes > TTS_CACHE_MAX_BYTES) {
    const oldestKey = ttsCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = ttsCache.get(oldestKey);
    if (oldest) ttsCacheBytes -= oldest.bytes;
    ttsCache.delete(oldestKey);
  }
}

export async function generateSpeech(
  text: string,
  voice: OpenAIVoice = "nova"
): Promise<Buffer> {
  // Prefer a direct OpenAI key for audio.speech; some AI gateway proxies
  // only support chat completions.
  const directKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
  const client = directKey
    ? new OpenAI({ apiKey: directKey })
    : getOpenAI();
  if (!client) {
    throw new Error("OpenAI not configured");
  }
  if (!VALID_VOICES.includes(voice)) {
    throw new Error(`Invalid voice. Choose one of: ${VALID_VOICES.join(", ")}`);
  }
  if (!text || text.length > 30000) {
    throw new Error("Text must be between 1 and 30,000 characters");
  }

  const key = ttsCacheKey(text, voice);
  const cached = ttsCacheGet(key);
  if (cached) return cached;

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    chunks.push(text.slice(i, i + MAX_CHUNK));
  }

  const buffers = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await client.audio.speech.create({
        model: "tts-1",
        voice,
        input: chunk,
        response_format: "mp3",
      });
      return Buffer.from(await response.arrayBuffer());
    }),
  );

  const combined = Buffer.concat(buffers);
  ttsCacheSet(key, combined);
  return combined;
}
