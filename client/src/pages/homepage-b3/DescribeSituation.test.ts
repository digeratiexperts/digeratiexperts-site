import { describe, expect, it, vi } from "vitest";
import { CARD_DATA_REJECTED_CODE, CARD_DATA_REJECTED_MESSAGE } from "@shared/pciGuard";
import { SITUATION_MATCH_NOTICE_VERSION } from "@shared/situationMatchNotice";
import { deskMatch, SITUATION_MATCH_AI_DISCLOSURE } from "./describeSituationMatch";

describe("SITUATION_MATCH_AI_DISCLOSURE", () => {
  it("identifies an AI assistant for Digerati Experts and describes what is kept", () => {
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/AI assistant for Digerati Experts/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/AI service provider/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/keep it in your session for \{\{CHAT_RETENTION\}\}/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/IT & Security Profile/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).toMatch(/See our Privacy Policy\./);
    expect(SITUATION_MATCH_AI_DISCLOSURE).not.toMatch(/Nothing is saved unless you choose to/);
    expect(SITUATION_MATCH_AI_DISCLOSURE).not.toMatch(/Digerati(?! Experts)/);
  });
});

describe("deskMatch", () => {
  it("does not call the API when the text looks like card data", async () => {
    const fetchImpl = vi.fn();
    const got = await deskMatch("please charge 4111111111111111", { turnstileToken: "tok", fetchImpl: fetchImpl as any });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(got).toEqual({ error: { code: CARD_DATA_REJECTED_CODE, message: CARD_DATA_REJECTED_MESSAGE } });
    expect(JSON.stringify(got)).not.toMatch(/4111/);
  });

  it("sends the situation-match notice version and does not local-match a card-data refusal", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ code: CARD_DATA_REJECTED_CODE, error: CARD_DATA_REJECTED_MESSAGE }), { status: 422 }));
    const got = await deskMatch("someone clicked a phishing link", { turnstileToken: "tok", sessionId: "s1", fetchImpl: fetchImpl as any });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.consent).toBe(true);
    expect(body.consentVersion).toBe(SITUATION_MATCH_NOTICE_VERSION);
    expect(body.text).toBe("someone clicked a phishing link");
    expect(got).toEqual({ error: { code: CARD_DATA_REJECTED_CODE, message: CARD_DATA_REJECTED_MESSAGE } });
  });
});
