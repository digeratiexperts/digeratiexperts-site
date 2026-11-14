import { describe, expect, it } from "vitest";
import {
  CARD_DATA_REJECTED_CODE,
  CARD_DATA_REJECTED_MESSAGE,
  CARD_DATA_REJECTED_STATUS,
  CardDataRejectedError,
  assertNoCardData,
  containsCvvOrCardExpiry,
  containsPan,
  looksLikeCardData,
  luhnValid,
  rejectCardData,
} from "./pciGuard";

/**
 * Well-known payment-processor test PANs (Stripe / Braintree / PayPal docs).
 * They are not live card numbers.
 */
const TEST_VISA = "4111111111111111";
const TEST_VISA_ALT = "4012888888881881";
const TEST_MC = "5555555555554444";
const TEST_MC_ALT = "5105105105105100";
const TEST_AMEX = "378282246310005";
const TEST_AMEX_ALT = "371449635398431";
const TEST_DISCOVER = "6011111111111117";
const TEST_VISA_13 = "4222222222222";
const INVALID_LUHN = "4111111111111112";

const groupedVisa = `${TEST_VISA.slice(0, 4)} ${TEST_VISA.slice(4, 8)} ${TEST_VISA.slice(8, 12)} ${TEST_VISA.slice(12)}`;

describe("luhnValid", () => {
  it("accepts well-known test PANs and rejects a nearby invalid checksum", () => {
    expect(luhnValid(TEST_VISA)).toBe(true);
    expect(luhnValid(TEST_VISA_ALT)).toBe(true);
    expect(luhnValid(TEST_MC)).toBe(true);
    expect(luhnValid(TEST_MC_ALT)).toBe(true);
    expect(luhnValid(TEST_AMEX)).toBe(true);
    expect(luhnValid(TEST_AMEX_ALT)).toBe(true);
    expect(luhnValid(TEST_DISCOVER)).toBe(true);
    expect(luhnValid(TEST_VISA_13)).toBe(true);
    expect(luhnValid(INVALID_LUHN)).toBe(false);
    expect(luhnValid("4805551234")).toBe(false);
    expect(luhnValid("0000000000000000")).toBe(true); // Luhn holds; IIN check still drops this
  });
});

describe("containsPan / looksLikeCardData", () => {
  it.each([
    TEST_VISA,
    `card ${TEST_VISA}`,
    `here it is: ${groupedVisa}`,
    `${TEST_VISA.slice(0, 4)}-${TEST_VISA.slice(4, 8)}-${TEST_VISA.slice(8, 12)}-${TEST_VISA.slice(12)}`,
    TEST_MC,
    `Amex ${TEST_AMEX}`,
    `3782 822463 10005`,
    TEST_DISCOVER,
    `please charge ${TEST_VISA_13}`,
    `card#${TEST_VISA}exp`,
    groupedVisa.replace(/ /g, "  "),
    groupedVisa.replace(/ /g, "."),
    groupedVisa.replace(/ /g, "/"),
    groupedVisa.replace(/ /g, "\n"),
    groupedVisa.replace(/ /g, "\u00A0"),
    groupedVisa.replace(/ /g, "\u2009"),
    `${TEST_VISA.slice(0, 4)}\t${TEST_VISA.slice(4, 8)}\t${TEST_VISA.slice(8, 12)}\t${TEST_VISA.slice(12)}`,
  ])("catches a PAN in %s", (line) => {
    expect(containsPan(line)).toBe(true);
    expect(looksLikeCardData(line)).toBe(true);
  });

  it.each([
    "Call me at (480) 555-1234",
    "+1 480 555 0199",
    "480-555-0199",
    "ZIP 85224",
    "ZIP 85224-1234",
    "Ticket TKT-M8K2-ABC",
    "Invoice INV-2024-001234",
    "ticket #998877",
    "Invoice 20261113001",
    "Call me at 4805551234 about ticket DE-10412",
    INVALID_LUHN,
    "0000000000000000",
    "1111111111111111",
    "the password is Tr0ub4dor&3",
    "pin = 482913",
    "I forgot my password",
    "",
    "   ",
  ])("lets a non-PAN line through: %s", (line) => {
    expect(containsPan(line)).toBe(false);
    expect(looksLikeCardData(line)).toBe(false);
  });
});

describe("CVV and card expiry", () => {
  it.each([
    "cvv: 123",
    "CVV 123",
    "my cvc is 1234",
    "my cvv is 123",
    "CVC: 4567",
    "security code: 456",
    "card verification value 789",
    "cid 1234",
  ])("catches an explicit CVV: %s", (line) => {
    expect(containsCvvOrCardExpiry(line)).toBe(true);
    expect(looksLikeCardData(line)).toBe(true);
  });

  it.each([
    "visa exp 12/28",
    "card expires 12/2028",
    "my credit card expiration date is 01/29",
    "Amex valid thru 3/27",
  ])("catches expiry when card context is present: %s", (line) => {
    expect(containsCvvOrCardExpiry(line)).toBe(true);
    expect(looksLikeCardData(line)).toBe(true);
  });

  it.each([
    "the contract expires 12/26",
    "valid until 01/2027",
    "apartment 123",
    "extension 1234",
    "PIN 1234",
    "suite 456",
  ])("does not treat ordinary numbers or dates as CVV/expiry: %s", (line) => {
    expect(containsCvvOrCardExpiry(line)).toBe(false);
    expect(looksLikeCardData(line)).toBe(false);
  });
});

describe("rejectCardData / assertNoCardData", () => {
  it("builds a structured refusal that never echoes the value", () => {
    const refusal = rejectCardData("please use " + TEST_VISA);
    expect(refusal).toEqual({ code: CARD_DATA_REJECTED_CODE, error: CARD_DATA_REJECTED_MESSAGE });
    expect(refusal?.error).not.toContain(TEST_VISA);
    expect(CARD_DATA_REJECTED_MESSAGE).not.toMatch(/Digerati(?! Experts)/);
    expect(rejectCardData("hello", "ticket #12")).toBeNull();
    expect(rejectCardData(undefined, "", "cvv 999")).toMatchObject({ code: CARD_DATA_REJECTED_CODE });
  });

  it("throws CardDataRejectedError without the submitted value", () => {
    expect(() => assertNoCardData("ok")).not.toThrow();
    try {
      assertNoCardData("pay with " + TEST_MC);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CardDataRejectedError);
      const rejected = err as CardDataRejectedError;
      expect(rejected.status).toBe(CARD_DATA_REJECTED_STATUS);
      expect(rejected.code).toBe(CARD_DATA_REJECTED_CODE);
      expect(rejected.message).toBe(CARD_DATA_REJECTED_MESSAGE);
      expect(rejected.message).not.toContain(TEST_MC);
    }
  });
});
