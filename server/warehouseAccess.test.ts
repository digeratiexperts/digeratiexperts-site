import { describe, expect, it, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-warehouse-access";

vi.mock("./portalAuthStore", async () => {
  const actual = await vi.importActual<typeof import("./portalAuthStore")>("./portalAuthStore");
  return { ...actual, getUser: vi.fn() };
});

vi.mock("./portalOrg", async () => {
  const actual = await vi.importActual<typeof import("./portalOrg")>("./portalOrg");
  return { ...actual, findUserById: vi.fn() };
});

function sign(claims: Record<string, unknown>) {
  return jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

describe("warehouse staff resolution", () => {
  beforeEach(async () => {
    const { getUser } = await import("./portalAuthStore");
    const { findUserById } = await import("./portalOrg");
    (getUser as ReturnType<typeof vi.fn>).mockReset();
    (findUserById as ReturnType<typeof vi.fn>).mockReset();
  });

  it("denies missing tokens and client live records", async () => {
    const { resolveWarehouseStaff } = await import("./warehouseAccess");
    const { getUser } = await import("./portalAuthStore");
    expect(resolveWarehouseStaff({ headers: {}, cookies: {} } as any)).toBeNull();

    (getUser as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "c1",
      email: "client@example.com",
      role: "user",
      isActive: true,
    });
    const req = {
      headers: { authorization: `Bearer ${sign({ userId: "c1", email: "client@example.com", role: "admin" })}` },
      cookies: {},
    } as any;
    expect(resolveWarehouseStaff(req)).toBeNull();
  });

  it("allows a live DE staff record (warehouse.access is deOnly)", async () => {
    const { resolveWarehouseStaff } = await import("./warehouseAccess");
    const { getUser } = await import("./portalAuthStore");
    (getUser as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "s1",
      email: "staff@digeratiexperts.com",
      role: "staff",
      isActive: true,
    });
    const req = {
      headers: { authorization: `Bearer ${sign({ userId: "s1", email: "staff@digeratiexperts.com", role: "staff" })}` },
      cookies: {},
    } as any;
    expect(resolveWarehouseStaff(req)).toEqual({ id: "s1", email: "staff@digeratiexperts.com" });
  });

  it("denies a disabled DE staff record", async () => {
    const { resolveWarehouseStaff } = await import("./warehouseAccess");
    const { getUser } = await import("./portalAuthStore");
    (getUser as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "s2",
      email: "gone@digeratiexperts.com",
      role: "staff",
      isActive: false,
    });
    const req = {
      headers: { authorization: `Bearer ${sign({ userId: "s2", email: "gone@digeratiexperts.com", role: "staff" })}` },
      cookies: {},
    } as any;
    expect(resolveWarehouseStaff(req)).toBeNull();
  });

  it("allows a live admin record", async () => {
    const { resolveWarehouseStaff } = await import("./warehouseAccess");
    const { getUser } = await import("./portalAuthStore");
    (getUser as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "a1",
      email: "admin@digeratiexperts.com",
      role: "admin",
      isActive: true,
    });
    const req = {
      headers: { authorization: `Bearer ${sign({ userId: "a1", email: "admin@digeratiexperts.com", role: "user" })}` },
      cookies: {},
    } as any;
    expect(resolveWarehouseStaff(req)).toEqual({
      id: "a1",
      email: "admin@digeratiexperts.com",
    });
  });
});
