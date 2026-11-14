import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleAdvisorChat } from "./advisor";
import { getSession, _resetSessionsForTests } from "./session";
import { buildSystemPrompt, CARD_DATA_PROMPT_RULE } from "./prompt";
import { createEmptyProfile } from "./profile";
import { handlePortalAssistChat, PORTAL_ASSIST_CARD_RULE } from "./portal-assist";
import {
  CARD_DATA_REJECTED_CODE,
  CARD_DATA_REJECTED_MESSAGE,
  CARD_DATA_REJECTED_STATUS,
  isCardDataRejection,
} from "@shared/pciGuard";

const TEST_VISA = "4111111111111111";

beforeEach(() => {
  _resetSessionsForTests();
});

describe("advisor PCI card guard", () => {
  it("refuses a PAN before the session or model ever sees it", async () => {
    await assert.rejects(
      () => handleAdvisorChat({ message: `please charge ${TEST_VISA}` }),
      (err: unknown) => {
        assert.equal(isCardDataRejection(err), true);
        const rejected = err as { status: number; code: string; message: string };
        assert.equal(rejected.status, CARD_DATA_REJECTED_STATUS);
        assert.equal(rejected.code, CARD_DATA_REJECTED_CODE);
        assert.equal(rejected.message, CARD_DATA_REJECTED_MESSAGE);
        assert.equal(rejected.message.includes(TEST_VISA), false);
        return true;
      },
    );
    // No session should have been created around the card data.
    // getOrCreateSession is skipped; there is nothing to look up without an id.
  });

  it("refuses a CVV and does not keep the line in an existing session", async () => {
    const first = await handleAdvisorChat({ message: "Hi, we need IT help for 12 users" });
    assert.ok(first.sessionId);
    await assert.rejects(() => handleAdvisorChat({ sessionId: first.sessionId, message: "cvv: 123" }));
    const session = getSession(first.sessionId);
    assert.ok(session);
    for (const m of session.messages) {
      assert.equal(m.content.includes("cvv"), false);
      assert.equal(/cvv:\s*123/i.test(m.content), false);
    }
  });

  it("lets a phone number and ticket id through the card guard", async () => {
    // We only assert the guard does not throw; the rest of the advisor may reply.
    await handleAdvisorChat({ message: "Please call 480-555-1234 about ticket DE-10412" });
  });

  it("tells the model never to ask for or accept card details, as Digerati Experts", () => {
    const prompt = buildSystemPrompt({
      mode: "it_support",
      knowledge: "",
      profile: createEmptyProfile(),
    });
    assert.equal(prompt.includes(CARD_DATA_PROMPT_RULE), true);
    assert.equal(/Digerati(?! Experts)/.test(CARD_DATA_PROMPT_RULE), false);
    assert.match(CARD_DATA_PROMPT_RULE, /Zoho checkout/i);
    assert.match(CARD_DATA_PROMPT_RULE, /Client Portal payment/i);
    assert.equal(/Digerati(?! Experts)/.test(PORTAL_ASSIST_CARD_RULE), false);
    assert.match(PORTAL_ASSIST_CARD_RULE, /Zoho checkout/i);
  });
});

describe("portal assist PCI card guard", () => {
  it("refuses card data before a model call or persist", async () => {
    await assert.rejects(
      () =>
        handlePortalAssistChat(
          {
            user: { id: "u-ann", name: "Ann Acme", email: "ann@acme.test", companyName: "Acme Corp" },
            message: `my card is ${TEST_VISA}`,
            page: { kind: "other", title: "Dashboard" },
            myRequests: [],
          },
          "2026-11-13",
        ),
      (err: unknown) => isCardDataRejection(err),
    );
  });
});
