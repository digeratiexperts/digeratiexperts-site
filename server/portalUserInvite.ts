import { randomBytes } from "crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import bcrypt from "bcrypt";
import {
  PortalPersistenceError,
  commitUser,
  getClient,
  getUser,
  type PortalAuthClient,
  type PortalAuthUser,
} from "./portalAuthStore";
import { issueAuthToken } from "./portalAuthTokens";
import { notificationService } from "./services/notificationService";

/**
 * POST /api/portal/admin/companies/:id/users — a DE admin adds a person to a
 * client company from Manage Companies (Joe, 2026-10-07: "Add user" so client
 * staff and the QA test account do not have to self-register, which creates a
 * "(Prospect)" company of their own).
 *
 * The account is created inside that company with an unusable random password
 * and a verified email (the only way in is the emailed link, which proves the
 * address). The person sets their own password through the existing
 * /portal/reset-password page, using a single-use link that lasts seven days.
 * Nobody, the admin included, ever sees or types the password.
 */

export const PORTAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_PATH = "/api/portal/admin/companies/:id/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteDeps = {
  getClient: (id: string) => PortalAuthClient | undefined;
  getUser: (key: string) => PortalAuthUser | undefined;
  commitUser: (user: PortalAuthUser) => Promise<void>;
  issueInviteToken: (user: PortalAuthUser) => Promise<string>;
  sendInvite: (data: { email: string; name: string; companyName: string; setPasswordLink: string }) => Promise<boolean>;
  baseUrl: () => string;
  newId: () => string;
  hashUnusablePassword: () => Promise<string>;
  logEvent: (event: string, req: Request, data: Record<string, unknown>) => void;
};

export const defaultInviteDeps: InviteDeps = {
  getClient: (id) => getClient(id),
  getUser: (key) => getUser(key),
  commitUser,
  issueInviteToken: (user) =>
    issueAuthToken({ purpose: "password_reset", userId: user.id, email: user.email, ttlMs: PORTAL_INVITE_TTL_MS }),
  sendInvite: (data) => notificationService.sendPortalInvite(data),
  baseUrl: () => process.env.APP_URL || "https://digeratiexperts.com",
  newId: () => randomBytes(16).toString("hex"),
  // A random secret nobody holds: the account cannot be signed in to until the
  // invitee sets a password from the link.
  hashUnusablePassword: () => bcrypt.hash(randomBytes(32).toString("hex"), 12),
  logEvent: (event, req, data) => {
    const user = (req as Request & { user?: { id?: string } }).user;
    console.log(`[SECURITY] ${event}`, JSON.stringify({ by: user?.id ?? null, ...data }));
  },
};

export function registerPortalUserInviteRoute(
  app: Express,
  opts: { guards: RequestHandler[]; deps?: Partial<InviteDeps> },
) {
  const deps: InviteDeps = { ...defaultInviteDeps, ...(opts.deps ?? {}) };

  app.post(INVITE_PATH, ...opts.guards, async (req: Request, res: Response) => {
    const company = deps.getClient(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.type === "msp") {
      return res.status(400).json({ error: "DE staff accounts are not added from a client company." });
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim().slice(0, 120) : "";
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!fullName) return res.status(400).json({ error: "Enter the person's name." });
    if (deps.getUser(email)) {
      return res.status(409).json({ error: "A portal account already uses this email." });
    }

    const user: PortalAuthUser = {
      id: deps.newId(),
      email,
      username: email,
      password: await deps.hashUnusablePassword(),
      fullName,
      role: "user",
      // Same mapping sign-in uses, so store pricing matches the company's plan.
      storeRole:
        company.serviceType === "managed" ? "managed" : company.serviceType === "comanaged" ? "comanaged" : "prospect",
      clientId: company.id,
      orgRole: "staff",
      emailVerified: true,
      isActive: true,
      createdAt: new Date(),
    };

    try {
      await deps.commitUser(user);
    } catch (error) {
      if (error instanceof PortalPersistenceError) {
        return res.status(503).json({ error: error.message, code: error.code });
      }
      console.error("[portal-invite] could not create user:", (error as Error)?.message || error);
      return res.status(500).json({ error: "The account could not be created." });
    }

    // The account exists from here on. If the link cannot be issued or sent,
    // the invitee can still use "Forgot password" on the sign-in page.
    let emailSent = false;
    try {
      const token = await deps.issueInviteToken(user);
      const setPasswordLink = `${deps.baseUrl()}/portal/reset-password?token=${token}`;
      emailSent = await deps.sendInvite({ email, name: fullName, companyName: company.companyName, setPasswordLink });
    } catch (error) {
      console.warn("[portal-invite] invite link not sent:", (error as Error)?.message || error);
    }

    deps.logEvent("PORTAL_USER_INVITED", req, { userId: user.id, clientId: company.id, emailSent });
    return res.status(201).json({
      success: true,
      emailSent,
      user: { id: user.id, email, fullName, role: user.role, isActive: true },
    });
  });
}
