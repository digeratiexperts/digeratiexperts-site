import { randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import { getUser, setUser, type PortalAuthUser } from "./portalAuthStore";

describe("portal auth cache identity index", () => {
  it("removes obsolete email and username aliases when a user identity changes", () => {
    const suffix = randomBytes(6).toString("hex");
    const original: PortalAuthUser = {
      id: `user-${suffix}`,
      email: `old-${suffix}@example.com`,
      username: `old-${suffix}`,
      password: "unused-test-hash",
      fullName: "Alias Test",
      role: "user",
      isActive: true,
    };

    setUser(original);
    setUser({
      ...original,
      email: `new-${suffix}@example.com`,
      username: `new-${suffix}`,
    });

    expect(getUser(original.email)).toBeUndefined();
    expect(getUser(original.username)).toBeUndefined();
    expect(getUser(`new-${suffix}@example.com`)?.id).toBe(original.id);
    expect(getUser(`new-${suffix}`)?.id).toBe(original.id);
  });
});
