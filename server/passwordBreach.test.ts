import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { BREACHED_PASSWORD_MESSAGE, newPasswordError, pwnedCount } from "./passwordBreach";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

function hibp(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}

describe("pwnedCount", () => {
  it("sends only the 5-character hash prefix and matches the suffix locally", async () => {
    const pw = "Harbor7Lantern!";
    const h = sha1(pw);
    const fetchImpl = hibp(`0000000000000000000000000000000000A:0\r\n${h.slice(5)}:42\r\n`);
    expect(await pwnedCount(pw, fetchImpl)).toBe(42);
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
    expect(url).not.toContain(h.slice(5));
  });

  it("returns 0 when the suffix is absent and null when the API fails", async () => {
    expect(await pwnedCount("Harbor7Lantern!", hibp("ABC:1"))).toBe(0);
    expect(await pwnedCount("Harbor7Lantern!", hibp("", 503))).toBeNull();
    expect(await pwnedCount("Harbor7Lantern!", vi.fn(async () => { throw new Error("offline"); }))).toBeNull();
  });
});

describe("newPasswordError", () => {
  it("checks local rules first, without calling HIBP", async () => {
    const fetchImpl = hibp("");
    expect(await newPasswordError("short", {}, fetchImpl)).toBe("Password must be at least 10 characters.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a breached password and fails open when HIBP is down", async () => {
    const pw = "Harbor7Lantern!";
    expect(await newPasswordError(pw, {}, hibp(`${sha1(pw).slice(5)}:3`))).toBe(BREACHED_PASSWORD_MESSAGE);
    expect(await newPasswordError(pw, {}, hibp("", 500))).toBeNull();
  });

  it("rejects a missing password", async () => {
    expect(await newPasswordError(undefined)).toBe("Password is required");
  });
});
