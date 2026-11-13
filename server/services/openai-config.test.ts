import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OpenAI canonical state", () => {
  it.each([undefined, "true", "false", "0"])("reports startup state and restart semantics for %s", async value => {
    vi.stubEnv("ENABLE_OPENAI_INTEGRATION", value);
    const { openaiConfig } = await import("./openai-config");
    const expected = value !== "false" && value !== "0";
    expect(openaiConfig.getStatus()).toMatchObject({ enabled: expected, persistence: "process", restartEnabled: expected });
  });
  it("reports configuration without keys or arbitrary endpoint contents", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key-never-send");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "synthetic-gateway-secret");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://user:synthetic-password@example.invalid/api?token=synthetic-token");
    const { openaiConfig } = await import("./openai-config");
    const status = openaiConfig.getStatus();
    expect(status).toHaveProperty("configured", true);
    expect(JSON.stringify(status)).not.toMatch(/synthetic-|example.invalid|apiKey|baseUrl/);
  });
  it("desired state is idempotent and does not change restart state", async () => {
    vi.stubEnv("ENABLE_OPENAI_INTEGRATION", "false");
    const { openaiConfig } = await import("./openai-config");
    openaiConfig.enable(); openaiConfig.enable();
    expect(openaiConfig.isEnabled()).toBe(true);
    expect(openaiConfig.getStatus()).toHaveProperty("restartEnabled", false);
    openaiConfig.disable(); openaiConfig.disable();
    expect(openaiConfig.isEnabled()).toBe(false);
  });
});
