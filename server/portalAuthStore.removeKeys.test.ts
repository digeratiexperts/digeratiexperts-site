import { describe, expect, it } from "vitest";
import {
  getUser,
  hasUser,
  removeUserKeys,
  setUser,
} from "./portalAuthStore";

describe("removeUserKeys", () => {
  it("drops a stale email so it no longer authenticates after an email change", () => {
    const user: any = {
      id: "user-remove-1",
      email: "old@example.com",
      username: "removeuser1",
      password: "x",
      role: "user",
      storeRole: "public",
      clientId: null,
    };
    setUser(user);
    expect(hasUser("old@example.com")).toBe(true);

    // Simulate the profile handler: change email, then purge the old key.
    user.email = "new@example.com";
    setUser(user);
    removeUserKeys(user.id, ["old@example.com"]);

    expect(getUser("old@example.com")).toBeUndefined();
    expect(getUser("new@example.com")?.id).toBe("user-remove-1");
  });

  it("does not remove a key that resolves to a different user", () => {
    const a: any = { id: "user-a", email: "a@example.com", username: "ua", password: "x", role: "user", storeRole: "public", clientId: null };
    const b: any = { id: "user-b", email: "b@example.com", username: "ub", password: "x", role: "user", storeRole: "public", clientId: null };
    setUser(a);
    setUser(b);
    // user-a tries to purge user-b's key — must be a no-op.
    removeUserKeys("user-a", ["b@example.com"]);
    expect(getUser("b@example.com")?.id).toBe("user-b");
  });
});
