import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let transport: ReturnType<typeof vi.fn>;
const completion = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ category: "Network", priority: "high", suggestedTags: ["network"] }) } }] }), { headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-only");
  vi.stubEnv("OPENAI_API", "");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "");
  vi.stubEnv("ENABLE_OPENAI_INTEGRATION", "true");
  transport = vi.fn(async (url: any) => String(url).includes("audio/speech") ? new Response(new Uint8Array([1, 2, 3])) : completion());
  vi.stubGlobal("fetch", transport);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OpenAI dispatch boundary (real SDK, mocked HTTP transport only)", () => {
  it("disabled classification/chat/summary preserve fallback with zero transport calls", async () => {
    const service = await import("./openaiService");
    const { openaiConfig } = await import("./services/openai-config");
    openaiConfig.disable();
    expect(await service.classifyTicket("Synthetic", "Synthetic")).toMatchObject({ category: "General" });
    expect(await service.generateChatResponse("Synthetic", [])).toContain("unavailable");
    expect(await service.summarizeTicket("Synthetic")).toContain("unavailable");
    expect(service.getOpenAI()).toBeNull();
    expect(transport).not.toHaveBeenCalled();
  });
  it("disabled speech cannot use a direct-key bypass", async () => {
    const { generateSpeech } = await import("./openaiService");
    const { openaiConfig } = await import("./services/openai-config");
    openaiConfig.disable();
    await expect(generateSpeech("Synthetic speech")).rejects.toThrow(/disabled/i);
    expect(transport).not.toHaveBeenCalled();
  });
  it("a retained SDK client cannot dispatch after disable", async () => {
    const { getOpenAI } = await import("./openaiService");
    const { openaiConfig } = await import("./services/openai-config");
    const client = getOpenAI()!;
    openaiConfig.disable();
    await expect(client.chat.completions.create({ model: "test-model", messages: [] }, { maxRetries: 0 })).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("disable between SDK retry attempts prevents the retry from reaching the provider", async () => {
    const { getOpenAI } = await import("./openaiService");
    const { openaiConfig } = await import("./services/openai-config");
    transport.mockImplementationOnce(async () => { openaiConfig.disable(); return new Response(JSON.stringify({ error: { message: "Synthetic upstream failure" } }), { status: 500 }); });
    await expect(getOpenAI()!.chat.completions.create({ model: "test-model", messages: [] }, { maxRetries: 1 })).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("enabled functions retain provider behavior and speech caching", async () => {
    const service = await import("./openaiService");
    expect(await service.classifyTicket("Synthetic", "Synthetic")).toMatchObject({ category: "Network", priority: "high" });
    await service.generateChatResponse("Synthetic", []);
    await service.summarizeTicket("Synthetic");
    expect(await service.generateSpeech("Cache fixture")).toEqual(Buffer.from([1, 2, 3]));
    expect(await service.generateSpeech("Cache fixture")).toEqual(Buffer.from([1, 2, 3]));
    expect(transport).toHaveBeenCalledTimes(4);
    const { openaiConfig } = await import("./services/openai-config");
    openaiConfig.disable();
    await expect(service.generateSpeech("Cache fixture")).rejects.toThrow(/disabled/i);
    expect(transport).toHaveBeenCalledTimes(4);
  });
});
