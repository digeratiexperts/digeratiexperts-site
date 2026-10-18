import { beforeEach, describe, expect, it, vi } from "vitest";
const portalGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/portalApi", () => ({ portalGet }));
import { verifyPortalReauthentication } from "./portalReauthentication";
beforeEach(() => vi.clearAllMocks());
describe("reauthentication preserves draft ownership", () => {
  it("allows only the same authenticated identity", async () => {
    portalGet.mockResolvedValue({ user: { id: "owner-a" } });
    await expect(verifyPortalReauthentication("owner-a")).resolves.toBeUndefined();
    await expect(verifyPortalReauthentication("owner-b")).rejects.toThrow("same account");
    await expect(verifyPortalReauthentication("")).rejects.toThrow("same account");
  });
  it("does not accept missing users or an expired session", async () => {
    portalGet.mockResolvedValue({});
    await expect(verifyPortalReauthentication("owner-a")).rejects.toThrow();
    portalGet.mockRejectedValue(new Error("401: Unauthorized"));
    await expect(verifyPortalReauthentication("owner-a")).rejects.toThrow("401");
  });
});
