import type { OpenAIControlStatus } from "@shared/openaiControl";

/** Preserve the existing startup contract: only literal false or 0 disables. */
const restartEnabled = process.env.ENABLE_OPENAI_INTEGRATION !== "false"
  && process.env.ENABLE_OPENAI_INTEGRATION !== "0";
let openaiEnabled = restartEnabled;

/** Runtime control for this process only. It does not write env or database state. */
export const openaiConfig = {
  isEnabled: (): boolean => openaiEnabled,
  enable(): void { openaiEnabled = true; },
  disable(): void { openaiEnabled = false; },
  getStatus(): OpenAIControlStatus {
    return {
      enabled: openaiEnabled,
      configured: Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY
        || process.env.OPENAI_API_KEY || process.env.OPENAI_API),
      persistence: "process",
      restartEnabled,
    };
  },
};

export function assertOpenAIEnabled(): void {
  if (!openaiConfig.isEnabled()) throw new Error("OpenAI integration is disabled");
}

/**
 * Check at SDK dispatch, including cached clients and automatic retries. A local
 * non-retryable response avoids the SDK retrying a thrown transport error. Calls
 * already dispatched cannot be recalled; the next dispatch observes this state.
 */
export const guardedOpenAIFetch: typeof fetch = (input, init) => {
  if (!openaiConfig.isEnabled()) {
    return Promise.resolve(new Response(JSON.stringify({
      error: { message: "OpenAI integration is disabled", code: "openai_disabled" },
    }), { status: 503, headers: { "Content-Type": "application/json", "x-should-retry": "false" } }));
  }
  return fetch(input, init);
};

export async function withOpenAIGuard<T>(asyncFn: () => Promise<T>): Promise<T | null> {
  if (!openaiConfig.isEnabled()) return null;
  // The caller owns fallback handling. Never log provider error objects here:
  // they may carry request metadata, endpoint credentials or customer content.
  return asyncFn();
}
