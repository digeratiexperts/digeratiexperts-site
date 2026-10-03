import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("./portalAuthStore", async () => {
  const actual = await vi.importActual<typeof import("./portalAuthStore")>("./portalAuthStore");
  return {
    ...actual,
    getUser: vi.fn(),
  };
});

vi.mock("./portalOrg", async () => {
  const actual = await vi.importActual<typeof import("./portalOrg")>("./portalOrg");
  return {
    ...actual,
    findUserById: vi.fn(),
  };
});

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-fail-closed-auth-test";

type LiveUser = {
  id: string;
  email: string;
  role: string;
  storeRole?: string | null;
  clientId?: string | null;
  orgRole?: string | null;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean;
  isActive?: boolean;
  fullName?: string;
  disabled?: boolean;
  status?: string;
};

function signToken(claims: Record<string, unknown>) {
  return jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: "24h" });
}

function mockResponse() {
  let statusCode: number | undefined;
  let body: any;
  return {
    res: {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        body = payload;
        return this;
      },
    } as any,
    status: () => statusCode,
    body: () => body,
  };
}

async function authenticate(live: LiveUser | undefined, claims: Record<string, unknown>) {
  const { authMiddleware } = await import("./routes");
  const { getUser } = await import("./portalAuthStore");
  const { findUserById } = await import("./portalOrg");
  (getUser as any).mockReturnValue(live);
  (findUserById as any).mockReturnValue(undefined);

  const token = signToken(claims);
  const req: any = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const response = mockResponse();
  const next = vi.fn();
  authMiddleware(req, response.res, next);
  return { req, next, ...response };
}

const activeLiveUser: LiveUser = {
  id: "u1",
  email: "real@example.com",
  role: "user",
  storeRole: "managed",
  clientId: "client-new",
  orgRole: "staff",
  departmentId: "dept-new",
  managerUserId: "manager-new",
  isCompanyItContact: false,
  isActive: true,
  fullName: "Real User",
};

// server/routes.ts is a very large module; its first import can take several
// seconds on a loaded runner. Load it once up front with a generous timeout so
// that cost is not charged to the first test's 5s budget.
beforeAll(async () => {
  await import("./routes");
}, 60_000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Portal authorization uses the live user as the source of truth", () => {
  it("denies a validly signed JWT whose user has no live record", async () => {
    const result = await authenticate(undefined, {
      userId: "ghost-user",
      email: "ghost@example.com",
      role: "admin",
      storeRole: "admin",
      clientId: "client-old",
    });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.status()).toBe(401);
    expect(result.body()?.error).toBeTruthy();
    expect(result.req.user).toBeUndefined();
  });

  it("applies live role and storeRole immediately after a downgrade", async () => {
    const { requireAdmin, requireRole } = await import("./routes");
    const result = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "admin",
      storeRole: "comanaged",
      clientId: "client-old",
    });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.req.user.role).toBe("user");
    expect(result.req.user.storeRole).toBe("managed");

    const adminResponse = mockResponse();
    const adminNext = vi.fn();
    requireAdmin(result.req, adminResponse.res, adminNext);
    expect(adminNext).not.toHaveBeenCalled();
    expect(adminResponse.status()).toBe(403);

    const checkoutResponse = mockResponse();
    const checkoutNext = vi.fn();
    requireRole("comanaged", "admin")(result.req, checkoutResponse.res, checkoutNext);
    expect(checkoutNext).not.toHaveBeenCalled();
    expect(checkoutResponse.status()).toBe(403);
  });

  it("uses the live client assignment instead of the stale JWT client", async () => {
    const result = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "user",
      storeRole: "managed",
      clientId: "client-old",
    });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.req.user.clientId).toBe("client-new");
  });

  it("does not resurrect an old client when the live clientId was cleared", async () => {
    const result = await authenticate(
      { ...activeLiveUser, clientId: null },
      {
        userId: "u1",
        email: "real@example.com",
        role: "user",
        storeRole: "managed",
        clientId: "client-old",
      },
    );

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.req.user.clientId).toBeNull();
  });

  it("derives organization authorization fields only from the live user", async () => {
    const result = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "user",
      storeRole: "managed",
      clientId: "client-old",
      orgRole: "company_it_contact",
      departmentId: "dept-old",
      managerUserId: "manager-old",
      isCompanyItContact: true,
    });

    expect(result.req.user.orgRole).toBe("staff");
    expect(result.req.user.departmentId).toBe("dept-new");
    expect(result.req.user.managerUserId).toBe("manager-new");
    expect(result.req.user.isCompanyItContact).toBe(false);
  });

  it("denies a live user explicitly marked inactive", async () => {
    const result = await authenticate(
      { ...activeLiveUser, isActive: false },
      {
        userId: "u1",
        email: "real@example.com",
        role: "user",
        storeRole: "managed",
      },
    );

    expect(result.next).not.toHaveBeenCalled();
    expect(result.status()).toBe(401);
  });

  it("does not preserve impersonation authority after a live admin downgrade", async () => {
    const result = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "admin",
      storeRole: "admin",
      impersonatingCompanyId: "client-victim",
      impersonatingCompanyName: "Victim Co",
    });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.req.user.role).toBe("user");
    expect(result.req.user.impersonatingCompanyId).toBeNull();
    expect(result.req.user.impersonatingCompanyName).toBeNull();
  });

  it("keeps an unchanged active user authenticated with live fields", async () => {
    const result = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "user",
      storeRole: "managed",
      clientId: "client-new",
    });

    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.status()).toBeUndefined();
    expect(result.req.user).toMatchObject({
      id: "u1",
      email: "real@example.com",
      role: "user",
      storeRole: "managed",
      clientId: "client-new",
    });
  });

  it("treats password and Zoho-issued sessions the same once the JWT reaches middleware", async () => {
    const password = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "admin",
      storeRole: "admin",
      clientId: "client-old",
      authMethod: "password",
    });
    const zoho = await authenticate(activeLiveUser, {
      userId: "u1",
      email: "real@example.com",
      role: "admin",
      storeRole: "admin",
      clientId: "client-old",
      authMethod: "zoho_sso",
    });

    expect(password.next).toHaveBeenCalledTimes(1);
    expect(zoho.next).toHaveBeenCalledTimes(1);
    expect(password.req.user).toEqual(zoho.req.user);
    expect(password.req.user.role).toBe("user");
    expect(password.req.user.clientId).toBe("client-new");
  });

  it("denies a token whose email names a live user but whose userId names a different account (#236)", async () => {
    // The attack: a validly-signed token (e.g. from the legacy /api/auth/register
    // path) carrying the victim's email but its own userId. The email lookup must
    // not be trusted unless it resolves to the token's own userId; here it does
    // not, and the userId resolves to nothing, so the request fails closed.
    const result = await authenticate(activeLiveUser, {
      userId: "attacker-legacy-row",
      email: "real@example.com",
      role: "admin",
      storeRole: "admin",
    });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.status()).toBe(401);
    expect(result.req.user).toBeUndefined();
  });

  it("denies a token that carries an email but no userId", async () => {
    const result = await authenticate(activeLiveUser, {
      email: "real@example.com",
      role: "admin",
    });

    expect(result.next).not.toHaveBeenCalled();
    expect(result.status()).toBe(401);
  });
});
