import { describe, expect, it } from "vitest";
import {
  MemStorage,
  resolvePortalDemoDataConfiguration,
  resolveStorageBackend,
} from "./storage";

const validBcryptHash = ["$2b$", "12$", "a".repeat(53)].join("");

describe("storage initialization security", () => {
  it("starts in-memory storage without default users or portal demo records", async () => {
    const storage = new MemStorage();

    await expect(
      storage.getUserByEmail("admin@digerati-experts.com"),
    ).resolves.toBeUndefined();
    await expect(storage.getPortalTickets()).resolves.toEqual([]);
  });

  it("requires an explicit non-production opt-in with a valid password hash", async () => {
    expect(
      resolvePortalDemoDataConfiguration({ NODE_ENV: "development" }),
    ).toEqual({ enabled: false });
    expect(() =>
      resolvePortalDemoDataConfiguration({
        NODE_ENV: "development",
        PORTAL_ENABLE_DEMO_DATA: "yes",
      }),
    ).toThrow("PORTAL_ENABLE_DEMO_DATA must be either true or false");
    expect(() =>
      resolvePortalDemoDataConfiguration({
        NODE_ENV: "development",
        PORTAL_ENABLE_DEMO_DATA: "true",
      }),
    ).toThrow("PORTAL_DEMO_PASSWORD_HASH must be a valid bcrypt hash");
    expect(() =>
      resolvePortalDemoDataConfiguration({
        NODE_ENV: "production",
        PORTAL_ENABLE_DEMO_DATA: "true",
        PORTAL_DEMO_PASSWORD_HASH: validBcryptHash,
      }),
    ).toThrow("Portal demo data cannot be enabled in production");

    const configuration = resolvePortalDemoDataConfiguration({
      NODE_ENV: "development",
      PORTAL_ENABLE_DEMO_DATA: "true",
      PORTAL_DEMO_PASSWORD_HASH: validBcryptHash,
    });
    expect(configuration).toEqual({
      enabled: true,
      passwordHash: validBcryptHash,
    });

    const storage = new MemStorage(configuration);
    await expect(storage.getPortalTickets()).resolves.not.toEqual([]);
    await expect(
      storage.getUserByEmail("admin@digerati-experts.com"),
    ).resolves.toBeUndefined();
  });

  it("fails closed without a durable database in production", () => {
    expect(() => resolveStorageBackend("production", false)).toThrow(
      "Production startup requires a durable database",
    );
    expect(resolveStorageBackend("production", true)).toBe("database");
    expect(resolveStorageBackend("development", false)).toBe("memory");
    expect(resolveStorageBackend("test", false)).toBe("memory");
  });
});
