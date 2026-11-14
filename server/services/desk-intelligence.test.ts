import { describe, expect, it } from "vitest";
import { createEmptyProfile } from "./msp-advisor/profile";
import {
  ADVISOR_MODE_RETRIEVAL_TERMS,
  buildAdvisorRetrievalQueries,
  getCanonicalPricingKnowledge,
  selectKnowledgeSlice,
} from "./msp-advisor/knowledge";
import { buildSystemPrompt, CARD_DATA_PROMPT_RULE } from "./msp-advisor/prompt";
import { verifyAdvisorReply } from "./msp-advisor/ground";
import { mergeKnowledgeHits, retrievePublicKnowledge } from "./de-intelligence/retrieve";
import type { KnowledgeRetrievalHit } from "./de-intelligence/types";
import { isTransientModelError, withTransientModelRetry, TRANSIENT_MODEL_BACKOFF_MS } from "./msp-advisor/model-retry";

const pricingKnowledge = getCanonicalPricingKnowledge();

describe("advisor retrieval queries", () => {
  it("includes the visitor message, original ask, and sales expansion terms", () => {
    const queries = buildAdvisorRetrievalQueries({
      mode: "pricing",
      userMessage: "How much for 20 users?",
      originalIntent: "We need managed IT and a price range",
    });
    expect(queries[0]).toBe("How much for 20 users?");
    expect(queries).toContain("We need managed IT and a price range");
    expect(queries.some((q) => /ProActive pricing floors/i.test(q))).toBe(true);
    expect(queries.join(" ")).toMatch(/IT Office Business Enterprise/i);
  });

  it("does not duplicate the same ask, and still expands support routing", () => {
    const queries = buildAdvisorRetrievalQueries({
      mode: "it_support",
      userMessage: "Outlook will not send mail",
      originalIntent: "Outlook will not send mail",
    });
    expect(queries.filter((q) => /Outlook will not send mail/i.test(q))).toHaveLength(1);
    expect(queries.some((q) => /Get Support/i.test(q))).toBe(true);
    expect(ADVISOR_MODE_RETRIEVAL_TERMS.it_support).toMatch(/support routing/i);
  });
});

describe("user-turn knowledge retrieval", () => {
  it("ranks the device-coverage policy when the visitor asks about BYOD allowance", () => {
    const slice = selectKnowledgeSlice("it_support", { pathname: "/", pageType: "home" }, [
      "Do you cover a personal phone if we are BYOD?",
      ADVISOR_MODE_RETRIEVAL_TERMS.it_support,
    ]);
    expect(slice).toMatch(/de-policy-device-coverage-v1/);
    expect(slice).toMatch(/company-owned, BYOD, or hybrid/i);
    expect(slice).not.toMatch(/de-internal-curation-workflow-v1/);
    expect(slice).toMatch(/Chandler, AZ/);
    expect(slice).not.toMatch(/\bAZ\s+\d{5}\b/);
  });

  it("injects canonical ProActive floors for a sales pricing question", () => {
    const queries = buildAdvisorRetrievalQueries({
      mode: "pricing",
      userMessage: "What does ProActive cost per user?",
    });
    const slice = selectKnowledgeSlice(
      "pricing",
      { pathname: "/solutions/proactive-it-ecosystem", pageType: "pricing" },
      queries,
    );
    expect(slice).toContain("$125/user");
    expect(slice).toContain("$1,600");
    expect(slice).toContain("$165/user");
    expect(slice).not.toContain("$129/user");
    expect(slice).toMatch(/GOVERNED DE INTELLIGENCE/);
  });

  it("keeps public retrieval fail-closed against the internal curation record", () => {
    const hits = retrievePublicKnowledge({
      query: "curation workflow review proposed knowledge",
      mode: "msp_discovery",
      limit: 10,
    });
    expect(hits.some((hit) => hit.record.id === "de-internal-curation-workflow-v1")).toBe(false);
    expect(hits.every((hit) => hit.record.scope === "public")).toBe(true);
  });

  it("merges multi-query hits by best score without duplicating records", () => {
    const a: KnowledgeRetrievalHit = {
      record: {
        id: "public-high",
        title: "A",
        summary: "A",
        content: "A",
        scope: "public",
        type: "kb_article",
        status: "active",
        authority: 80,
        tags: [],
        source: { kind: "canonical", label: "t" },
      },
      score: 2,
      reasons: ["q1"],
    };
    const b: KnowledgeRetrievalHit = {
      ...a,
      score: 5,
      reasons: ["q2"],
    };
    const extra: KnowledgeRetrievalHit = {
      record: { ...a.record, id: "public-low", authority: 40 },
      score: 1,
      reasons: ["q1"],
    };
    const merged = mergeKnowledgeHits([[a, extra], [b]], 6);
    expect(merged.map((hit) => hit.record.id)).toEqual(["public-high", "public-low"]);
    expect(merged[0].score).toBe(5);
    expect(merged[0].reasons).toEqual(expect.arrayContaining(["q1", "q2"]));
  });
});

describe("sales-intent prompt layout", () => {
  it("puts stable DE rules and honest AI identity before retrieved knowledge", () => {
    const knowledge = selectKnowledgeSlice("pricing", { pathname: "/", pageType: "pricing" }, [
      "How much is ProActive Office?",
    ]);
    const prompt = buildSystemPrompt({
      mode: "pricing",
      knowledge,
      profile: createEmptyProfile(),
      lastUserMessage: "How much is ProActive Office?",
      originalIntent: "Looking for managed IT pricing",
    });

    const identityAt = prompt.indexOf("You are DE Desk, an AI assistant for Digerati Experts");
    const rulesAt = prompt.indexOf("HARD RULES:");
    const contextAt = prompt.indexOf("--- THIS-TURN CONTEXT ---");
    const knowledgeAt = prompt.indexOf("--- GROUNDED DE KNOWLEDGE");
    expect(identityAt).toBeGreaterThanOrEqual(0);
    expect(rulesAt).toBeGreaterThan(identityAt);
    expect(contextAt).toBeGreaterThan(rulesAt);
    expect(knowledgeAt).toBeGreaterThan(contextAt);
    expect(prompt).toMatch(/not a person/);
    expect(prompt).toContain(CARD_DATA_PROMPT_RULE);
    expect(prompt).toMatch(/Never "Digerati" alone/);
    expect(prompt).toMatch(/Chandler, AZ only/);
    expect(prompt).toMatch(/SALES ROUTING/);
    expect(prompt).toMatch(/ORIGINAL ASK \(still open\): Looking for managed IT pricing/);
    expect(prompt).toContain("$165/user");
    // Knowledge must not precede the stable rules block.
    expect(prompt.indexOf("GOVERNED DE INTELLIGENCE")).toBeGreaterThan(rulesAt);
  });

  it("does not attach sales routing guidance in an emergency lane", () => {
    const prompt = buildSystemPrompt({
      mode: "security_incident",
      knowledge: "incident knowledge",
      profile: createEmptyProfile(),
      lastUserMessage: "We have ransomware right now",
    });
    expect(prompt).not.toMatch(/SALES ROUTING/);
    expect(prompt).toMatch(/EMERGENCY LANE/);
  });
});

describe("groundedness verifier", () => {
  const ctx = { knowledge: pricingKnowledge, userMessage: "What does IT cost?" };

  it("repairs a bare Digerati brand and leaves Digerati Experts alone", () => {
    const bare = verifyAdvisorReply(
      "Digerati can help you get started with a Cyber Risk Assessment.",
      { knowledge: "Cyber Risk Assessment is the usual first step." },
    );
    expect(bare.ok).toBe(true);
    expect(bare.repaired).toBe(true);
    expect(bare.violations).toContain("bare_brand");
    expect(bare.reply).toBe(
      "Digerati Experts can help you get started with a Cyber Risk Assessment.",
    );
    expect(bare.reply).not.toMatch(/Digerati(?! Experts)/);

    const fine = verifyAdvisorReply(
      "Digerati Experts can help you get started with a Cyber Risk Assessment.",
      { knowledge: "Cyber Risk Assessment is the usual first step." },
    );
    expect(fine.ok).toBe(true);
    expect(fine.repaired).toBe(false);
    expect(fine.violations).toEqual([]);
  });

  it("allows canonical ProActive floors and rejects an invented price", () => {
    const ok = verifyAdvisorReply(
      "ProActive IT starts at $125/user/mo with a $1,600 monthly minimum. About how many users do you support?",
      ctx,
    );
    expect(ok.ok).toBe(true);
    expect(ok.violations).toEqual([]);

    const bad = verifyAdvisorReply(
      "We can do it for $99 per user, well below our usual $125/user floor.",
      ctx,
    );
    expect(bad.ok).toBe(false);
    expect(bad.violations).toContain("ungrounded_price");
  });

  it("allows a price the visitor already stated, even if it is not a DE floor", () => {
    const result = verifyAdvisorReply(
      "You mentioned $200 per user with your current provider — DE would confirm scope against our published floors rather than match that number.",
      {
        knowledge: pricingKnowledge,
        userMessage: "We currently pay $200 per user. Can you beat that?",
      },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects ungrounded SLA, metrics, and certification claims", () => {
    expect(
      verifyAdvisorReply("We guarantee a 15-minute response SLA on every ticket.", ctx).violations,
    ).toContain("ungrounded_sla");
    expect(
      verifyAdvisorReply("Digerati Experts protects 500 clients with 99.99% uptime.", ctx)
        .violations,
    ).toEqual(expect.arrayContaining(["ungrounded_metric"]));
    expect(
      verifyAdvisorReply("Digerati Experts is SOC 2 certified and can certify you too.", {
        knowledge: "Digerati Experts helps with audit readiness. DE does not provide legal compliance signoff or certify a customer under HIPAA, SOC 2, PCI, CMMC, or similar frameworks.",
      }).violations,
    ).toContain("ungrounded_certification");
  });

  it("repairs a street address or ZIP to the public Chandler, AZ city line", () => {
    const result = verifyAdvisorReply(
      "Visit us at 123 West Example Street, Chandler, AZ 85225 and we will help.",
      { knowledge: pricingKnowledge },
    );
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.violations).toContain("street_address");
    expect(result.reply).toMatch(/Chandler, AZ/);
    expect(result.reply).not.toMatch(/123 West Example Street/i);
    expect(result.reply).not.toMatch(/85225/);
  });

  it("does not treat a phone number or user count as an ungrounded price", () => {
    const result = verifyAdvisorReply(
      "Call Digerati Experts at 480-555-1234 and tell us you have 12 users.",
      { knowledge: "Phone: 480-555-1234" },
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe("transient model retry", () => {
  it("treats rate limits and timeouts as transient, but not client errors", () => {
    expect(isTransientModelError({ status: 429, message: "rate limit" })).toBe(true);
    expect(isTransientModelError({ status: 503, message: "overloaded" })).toBe(true);
    expect(isTransientModelError({ code: "ETIMEDOUT", message: "timeout" })).toBe(true);
    expect(isTransientModelError({ status: 400, message: "bad request" })).toBe(false);
    expect(isTransientModelError({ status: 401, message: "unauthorized" })).toBe(false);
  });

  it("retries once after a brief backoff on a transient error, then succeeds", async () => {
    const slept: number[] = [];
    let calls = 0;
    const result = await withTransientModelRetry(
      async () => {
        calls += 1;
        if (calls === 1) {
          const err = Object.assign(new Error("429 rate limit"), { status: 429 });
          throw err;
        }
        return "ok";
      },
      { sleep: async (ms) => { slept.push(ms); } },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
    expect(slept).toEqual([TRANSIENT_MODEL_BACKOFF_MS]);
  });

  it("does not retry a non-transient error", async () => {
    let calls = 0;
    await expect(
      withTransientModelRetry(async () => {
        calls += 1;
        throw Object.assign(new Error("bad request"), { status: 400 });
      }, { sleep: async () => { throw new Error("should not sleep"); } }),
    ).rejects.toThrow(/bad request/);
    expect(calls).toBe(1);
  });
});
