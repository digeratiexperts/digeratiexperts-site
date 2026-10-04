import { describe, expect, it } from "vitest";
import { isLocalRequest } from "./ingest";

describe("isLocalRequest", () => {
  it("allows a direct loopback call with no forwarded client", () => {
    expect(isLocalRequest({ socket: { remoteAddress: "127.0.0.1" } })).toBe(true);
  });

  it("rejects a proxied request even when the forwarding header says loopback", () => {
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "127.0.0.1" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "127.0.0.1, 203.0.113.10" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "x-forwarded-for": "203.0.113.10, 127.0.0.1" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "::ffff:127.0.0.1" },
        headers: { "x-real-ip": "198.51.100.4" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "::ffff:127.0.0.1" },
        headers: { "x-real-ip": "127.0.0.1" },
      }),
    ).toBe(false);
  });

  it("never trusts a forged CF-Connecting-IP (#261)", () => {
    expect(
      isLocalRequest({
        socket: { remoteAddress: "203.0.113.10" },
        headers: { "cf-connecting-ip": "127.0.0.1" },
      }),
    ).toBe(false);
    expect(
      isLocalRequest({
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "cf-connecting-ip": "127.0.0.1", "x-forwarded-for": "127.0.0.1, 203.0.113.10" },
      }),
    ).toBe(false);
  });

  it("rejects a non-loopback socket", () => {
    expect(isLocalRequest({ socket: { remoteAddress: "203.0.113.10" } })).toBe(false);
  });
});
