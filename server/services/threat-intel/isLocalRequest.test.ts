import { describe, expect, it } from "vitest";
import { isLocalRequest } from "./ingest";

describe("isLocalRequest", () => {
  it("allows a direct loopback call with no forwarded client", () => {
    expect(isLocalRequest({ socket: { remoteAddress: "127.0.0.1" } })).toBe(true);
  });

  it("rejects a proxied public request that only looks local at the socket", () => {
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "::ffff:127.0.0.1" },
        headers: { "x-real-ip": "198.51.100.4" },
      }),
    ).toBe(false);
  });

  it("still allows a loopback client forwarded by the local proxy", () => {
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "127.0.0.1" },
      }),
    ).toBe(true);
  });
});
