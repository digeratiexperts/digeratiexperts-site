import { afterEach, describe, expect, it } from "vitest";
import { AUTORENEW_CONTRACT_ENV, isAutoRenewContractEnabled } from "./autoRenewContract";

const original = process.env[AUTORENEW_CONTRACT_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[AUTORENEW_CONTRACT_ENV];
  else process.env[AUTORENEW_CONTRACT_ENV] = original;
});

describe("isAutoRenewContractEnabled", () => {
  it("is disabled by default when the env var is unset", () => {
    delete process.env[AUTORENEW_CONTRACT_ENV];
    expect(isAutoRenewContractEnabled()).toBe(false);
    expect(isAutoRenewContractEnabled({})).toBe(false);
  });

  it("stays disabled for false-like values", () => {
    for (const value of ["", "false", "0", "no", "off", "FALSE"]) {
      expect(isAutoRenewContractEnabled({ [AUTORENEW_CONTRACT_ENV]: value })).toBe(false);
    }
  });

  it("enables only for explicit truthy values", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on", " True "]) {
      expect(isAutoRenewContractEnabled({ [AUTORENEW_CONTRACT_ENV]: value })).toBe(true);
    }
  });
});
