import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  _resetSituationMatchConsentForTests,
  recordSituationMatchConsent,
  situationMatchConsentFor,
} from "./situationMatchConsent";

describe("recordSituationMatchConsent", () => {
  it("records the notice version and a server timestamp, ignoring any client-supplied time", () => {
    _resetSituationMatchConsentForTests();
    const before = Date.now();
    const record = recordSituationMatchConsent({ version: "situation-match-v2", sessionId: "abc" });
    const after = Date.now();
    assert.equal(record.version, "situation-match-v2");
    assert.equal(record.sessionId, "abc");
    assert.ok(record.at >= before);
    assert.ok(record.at <= after);
    assert.deepEqual(situationMatchConsentFor("abc"), record);
  });
});
