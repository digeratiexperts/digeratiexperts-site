import { describe, expect, it } from "vitest";
import { CARD_DATA_REJECTED_MESSAGE } from "@shared/pciGuard";
import {
  DE_SECURE_REQUEST_TEMPLATE,
  DE_SECURE_REQUEST_TEMPLATE_WEBSITE,
  SECRET_IN_AGENT_REPLY_WARNING,
  SECRET_IN_CHAT_WARNING,
  SECRET_IN_CHAT_WARNING_WEBSITE,
  SECURE_FIELD_KINDS,
  SECURE_FIELD_REVEAL_COPY,
  SECURE_FIELD_STORED_COPY,
  looksLikeSecret,
  secureFieldPayload,
  secureFieldProblem,
  secureFieldSummary,
} from "./deskSecureField";

const TEST_VISA = "4111111111111111";

const FAKE = "fake-placeholder-Zx9";

describe("DE Desk secure field helpers (#1179)", () => {
  it("offers the Hub's kinds, licence spelled as DE spells it", () => {
    expect(SECURE_FIELD_KINDS.map((k) => k.value)).toEqual(["password", "wifi", "license_key", "pin", "api_key", "other"]);
    expect(SECURE_FIELD_KINDS.find((k) => k.value === "license_key")?.label).toBe("Licence key");
  });

  it("validates without ever repeating the value", () => {
    expect(secureFieldProblem({ label: "", secretValue: FAKE })).toMatch(/what it is for/i);
    expect(secureFieldProblem({ label: "Wi-Fi", secretValue: "" })).toMatch(/enter the value/i);
    const inLabel = secureFieldProblem({ label: `Wi-Fi ${FAKE}`, secretValue: FAKE });
    expect(inLabel).toMatch(/description contains the secret/i);
    expect(inLabel).not.toContain(FAKE);
    expect(secureFieldProblem({ label: "Wi-Fi", secretValue: FAKE })).toBeNull();
  });

  it("builds the request body without trimming or altering the value", () => {
    expect(secureFieldPayload({ label: "  Wi-Fi ", kind: "wifi", secretValue: `  ${FAKE}<&> ` })).toEqual({ label: "Wi-Fi", kind: "wifi", secretValue: `  ${FAKE}<&> ` });
  });

  it("summarises a stored field with no value in it", () => {
    const line = secureFieldSummary({ label: "Office Wi-Fi", kind: "wifi", status: "active", expiresAt: "2026-11-19T15:00:00.000Z" }, new Date("2026-11-12T15:00:00.000Z"));
    expect(line).toMatch(/^Office Wi-Fi \(Wi-Fi key\): stored securely until Nov 19$/);
    expect(secureFieldSummary({ label: "Old", kind: "pin", status: "expired", expiresAt: "2026-11-01T00:00:00.000Z" })).toMatch(/expired, value removed/);
  });

  it.each([
    "the password is Tr0ub4dor&3",
    "Wi-Fi key: fake-placeholder-wifi",
    "pin = 482913",
    "publishable key pk_test_EXAMPLEdummyplaceholder0000",
    "here you go ABCDE-12345-FGHIJ-67890-KLMNO",
    "AKIAEXAMPLEDUMMY0000",
    "password: \"hunter22\"",
  ])("catches a credential in a chat line: %s", (line) => {
    expect(looksLikeSecret(line)).toBe(true);
  });

  it.each([
    "I forgot my password",
    "my password is expired",
    "password is not working on the laptop",
    "my password is still wrong",
    "Can you reset the Wi-Fi?",
    "What's the PIN policy for phones?",
    "The licence key page won't load",
    "",
  ])("lets an ordinary support line through: %s", (line) => {
    expect(looksLikeSecret(line)).toBe(false);
  });

  it("rejects a PAN in any secure-field kind, including other and pin", () => {
    for (const _kind of ["password", "wifi", "license_key", "pin", "api_key", "other"]) {
      const problem = secureFieldProblem({ label: "Office login", secretValue: TEST_VISA });
      expect(problem).toBe(CARD_DATA_REJECTED_MESSAGE);
      expect(problem).not.toContain(TEST_VISA);
    }
    expect(secureFieldProblem({ label: `Card ${TEST_VISA}`, secretValue: "office-wifi" })).toBe(CARD_DATA_REJECTED_MESSAGE);
    expect(looksLikeSecret(`please charge ${TEST_VISA}`)).toBe(true);
  });

  it("says Digerati Experts or DE, never Digerati alone", () => {
    for (const copy of [SECURE_FIELD_STORED_COPY, SECURE_FIELD_REVEAL_COPY, SECRET_IN_CHAT_WARNING, SECRET_IN_CHAT_WARNING_WEBSITE, DE_SECURE_REQUEST_TEMPLATE, DE_SECURE_REQUEST_TEMPLATE_WEBSITE, SECRET_IN_AGENT_REPLY_WARNING]) {
      expect(copy).not.toMatch(/Digerati(?! Experts)/);
    }
  });
});
