import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCanonicalPricingKnowledge, selectKnowledgeSlice } from "./knowledge";
import {
  findGroundingIssues,
  repairBareDigerati,
  stripStreetAddresses,
  verifyGroundedReply,
} from "./ground";

const FALLBACK = "Tell me a bit more about your environment and I'll give you a confirmed next step.";

describe("grounded reply verifier", () => {
  it("allows canonical package floors from pricing knowledge", () => {
    const knowledge = getCanonicalPricingKnowledge();
    const issues = findGroundingIssues(
      "ProActive Office starts at $165/user, with a $1,600 monthly minimum.",
      knowledge,
    );
    assert.deepEqual(issues, []);
  });

  it("rejects a dollar amount that is not in the knowledge or the visitor's message", () => {
    const knowledge = selectKnowledgeSlice("msp_discovery");
    const issues = findGroundingIssues("We can do that for $99 per user.", knowledge);
    assert.ok(issues.includes("ungrounded_price"));
  });

  it("allows a price the visitor just mentioned, even when it is not a DE floor", () => {
    const knowledge = selectKnowledgeSlice("pricing");
    const issues = findGroundingIssues(
      "I don't have a $99/user package on the list. The published Office floor is $165/user.",
      knowledge,
      "Is it $99 per user?",
    );
    assert.deepEqual(issues, []);
  });

  it("flags invented SLA commitments and certification claims", () => {
    const knowledge = selectKnowledgeSlice("compliance");
    assert.ok(
      findGroundingIssues("We guarantee 99.9% uptime and a 15-minute response SLA.", knowledge).includes(
        "ungrounded_sla",
      ),
    );
    assert.ok(
      findGroundingIssues("Digerati Experts is SOC 2 certified and will make you HIPAA compliant.", knowledge).includes(
        "ungrounded_certification",
      ),
    );
    assert.ok(
      !findGroundingIssues(
        "DE helps with audit readiness and evidence. DE does not certify a customer under HIPAA or SOC 2.",
        knowledge,
      ).includes("ungrounded_certification"),
    );
  });

  it("flags a street address or ZIP and repairs it to a city-only line", () => {
    const withStreet = "Visit us at 123 Main Street, Chandler, AZ 85225 for a walkthrough.";
    assert.ok(findGroundingIssues(withStreet).includes("street_address"));
    const stripped = stripStreetAddresses(withStreet);
    assert.doesNotMatch(stripped, /123 Main/i);
    assert.doesNotMatch(stripped, /85225/);
    assert.match(stripped, /Chandler, AZ/i);
  });

  it("repairs a bare Digerati to Digerati Experts and leaves domains alone", () => {
    assert.equal(repairBareDigerati("Call Digerati if you need help."), "Call Digerati Experts if you need help.");
    assert.equal(
      repairBareDigerati("Email us via digeratiexperts.com or digerati-experts.com."),
      "Email us via digeratiexperts.com or digerati-experts.com.",
    );
    assert.equal(repairBareDigerati("Digerati Experts can help."), "Digerati Experts can help.");
  });

  it("returns a safe fallback when a claim cannot be repaired", () => {
    const result = verifyGroundedReply({
      reply: "Sign today and we guarantee a 4-hour response SLA for $49/user.",
      knowledge: selectKnowledgeSlice("pricing"),
      fallbackReply: FALLBACK,
    });
    assert.equal(result.ok, false);
    assert.equal(result.fellBack, true);
    assert.equal(result.reply, FALLBACK);
    assert.ok(result.issues.includes("ungrounded_price") || result.issues.includes("ungrounded_sla"));
  });

  it("repairs a bare company name in place when that is the only issue", () => {
    const result = verifyGroundedReply({
      reply: "Digerati can take a support ticket from this window.",
      knowledge: selectKnowledgeSlice("it_support"),
      fallbackReply: FALLBACK,
    });
    assert.equal(result.ok, true);
    assert.equal(result.repaired, true);
    assert.match(result.reply, /Digerati Experts can take a support ticket/);
    assert.doesNotMatch(result.reply, /\bDigerati\b(?!\s+Experts)/);
  });
});
