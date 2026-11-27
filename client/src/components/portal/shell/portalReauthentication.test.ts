import { beforeEach, describe, expect, it, vi } from "vitest";

const { readPortalSessionForRecovery, resumeVerifiedPortalSubmission } = vi.hoisted(() => ({
  readPortalSessionForRecovery: vi.fn(), resumeVerifiedPortalSubmission: vi.fn(),
}));
vi.mock("@/lib/portalSubmission", () => ({ readPortalSessionForRecovery, resumeVerifiedPortalSubmission }));
import { verifyPortalReauthentication } from "./portalReauthentication";

beforeEach(() => vi.clearAllMocks());

describe("reauthentication preserves draft ownership", () => {
  it("accepts the proof from the very response that verified the expected user", async () => {
    const response = Response.json({ user: { id: "owner-a" } });
    readPortalSessionForRecovery.mockResolvedValue(response);
    await verifyPortalReauthentication("owner-a");
    expect(resumeVerifiedPortalSubmission).toHaveBeenCalledWith(response);
  });

  it("rejects a different user, an unknown owner, a missing user and an expired session", async () => {
    for (const [owner, response] of [
      ["owner-b", Response.json({ user: { id: "owner-a" } })],
      ["", Response.json({ user: { id: "owner-a" } })],
      ["owner-a", Response.json({})],
      ["owner-a", Response.json({}, { status: 401 })],
    ] as const) {
      readPortalSessionForRecovery.mockResolvedValueOnce(response);
      await expect(verifyPortalReauthentication(owner)).rejects.toThrow();
    }
    expect(resumeVerifiedPortalSubmission).not.toHaveBeenCalled();
  });
});
