import { describe, expect, it } from "vitest";
import {
  signPortalAuthToken,
  signWorkspaceAuthToken,
  verifyPortalAuthToken,
  verifyWorkspaceAuthToken,
} from "./authTokens";

const SECRET = "test-secret-that-is-long-enough-for-auth-boundary-tests";

describe("JWT audience boundaries", () => {
  it("accepts portal tokens only at the portal verifier", () => {
    const token = signPortalAuthToken(
      {
        userId: "portal-user",
        email: "portal@example.com",
        role: "user",
        portalSessionId: "portal-session",
      },
      SECRET,
      "1h",
    );

    expect(verifyPortalAuthToken(token, SECRET)).toMatchObject({
      userId: "portal-user",
      tokenType: "portal",
      portalSessionId: "portal-session",
    });
    expect(() => verifyWorkspaceAuthToken(token, SECRET)).toThrow();
  });

  it("accepts workspace tokens only at the workspace verifier", () => {
    const token = signWorkspaceAuthToken(
      { userId: "workspace-user", email: "workspace@example.com", role: "user" },
      SECRET,
      "1h",
    );

    expect(verifyWorkspaceAuthToken(token, SECRET)).toMatchObject({
      userId: "workspace-user",
      tokenType: "workspace",
    });
    expect(() => verifyPortalAuthToken(token, SECRET)).toThrow();
  });
});
