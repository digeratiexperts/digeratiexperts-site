import { describe, expect, it } from "vitest";
import { validateProfileEmailUpdate } from "./portalAccountSecurity";

describe("portal profile email security", () => {
  it("allows the current address but blocks a session from replacing the login address", () => {
    expect(validateProfileEmailUpdate("owner@example.com", undefined)).toEqual({ ok: true });
    expect(validateProfileEmailUpdate("owner@example.com", " Owner@Example.com ")).toEqual({
      ok: true,
    });
    expect(validateProfileEmailUpdate("owner@example.com", "attacker@example.com")).toEqual({
      ok: false,
      message:
        "Email changes require verified support. Submit a portal ticket to update the login address.",
    });
  });
});
