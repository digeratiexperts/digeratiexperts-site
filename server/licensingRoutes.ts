import type { Express, Request, RequestHandler, Response } from "express";
import {
  classificationFor,
  getLicensePolicy,
  listUserAccounts,
  setLicensePolicy,
  setUserAccount,
} from "./licensingStore";
import { effectiveClientId, type DirectoryClient, type DirectoryUser, type ServiceRequestUser } from "./serviceRequestRoutes";
import {
  ACCOUNT_TYPES,
  LICENSE_CATALOG,
  LICENSE_PLATFORMS,
  requestableLicenses,
  resolveBaseLicense,
  validateLicensePolicy,
  type AccountType,
} from "@shared/licensing";

/**
 * Licensing in the Client Portal.
 *
 *   GET  /api/portal/licensing                 the company policy and my licences (any signed-in client user)
 *   GET  /api/portal/licensing/entitlements    what an account in my company can hold or request (the licence form)
 *   GET  /api/portal/licensing/people          everyone's account type (company IT contact / org admin, DE admin)
 *   PUT  /api/portal/licensing/people/:userId  set a person's account type and tier (same roles)
 *   GET/PUT /api/portal/admin/licensing/policy?clientId=  the policy itself (DE admin only)
 *
 * The company always comes from the session. The policy is DE's to set: it
 * decides who is licensed automatically, which is a commercial commitment.
 */

type AuthedRequest = Request & { user?: ServiceRequestUser & { orgRole?: string | null; isCompanyItContact?: boolean | null } };

export type LicensingRouteDeps = {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  getClient: (id: string) => DirectoryClient | undefined;
  findUser: (id: string) => DirectoryUser | undefined;
  listClientUsers: (clientId: string) => DirectoryUser[];
  /** Company IT contact or org admin of their own company, or DE admin. */
  canManagePeople: (user: AuthedRequest["user"]) => boolean;
};

const ACCOUNT_TYPE_KEYS = new Set<string>(ACCOUNT_TYPES.map((a) => a.key));

export function registerLicensingRoutes(app: Express, deps: LicensingRouteDeps): void {
  const company = (req: AuthedRequest, res: Response): string | null => {
    const clientId = effectiveClientId(req.user);
    if (!clientId || !deps.getClient(clientId)) {
      res.status(400).json({ error: req.user?.role === "admin" ? "Open a company (impersonate) first." : "Your account is not linked to a company yet." });
      return null;
    }
    return clientId;
  };

  app.get("/api/portal/licensing", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    const policy = await getLicensePolicy(clientId);
    const me = await classificationFor(req.user!.id, clientId);
    res.json({
      success: true,
      company: { id: clientId, name: deps.getClient(clientId)!.companyName },
      catalog: LICENSE_CATALOG,
      platforms: LICENSE_PLATFORMS,
      policy,
      me: { ...me, licenses: requestableLicenses(policy, me) },
      canManagePeople: deps.canManagePeople(req.user),
      canEditPolicy: req.user?.role === "admin",
    });
  });

  app.get("/api/portal/licensing/entitlements", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    const kind = String(req.query.accountKind || "person");
    const policy = await getLicensePolicy(clientId);
    let who: { accountType: AccountType; tier: string | null };
    if (kind === "person") {
      const userId = String(req.query.userId || "");
      const target = userId ? deps.findUser(userId) : undefined;
      if (!target || target.clientId !== clientId) return res.status(404).json({ error: "Person not found" });
      const c = await classificationFor(target.id, clientId);
      who = { accountType: c.accountType, tier: c.tier };
    } else if (kind === "admin" || kind === "service" || kind === "shared") {
      who = { accountType: kind, tier: null };
    } else {
      return res.status(400).json({ error: "Unknown account kind" });
    }
    res.json({ success: true, classification: who, platforms: policy.platforms, licenses: requestableLicenses(policy, who) });
  });

  app.get("/api/portal/licensing/people", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    if (!deps.canManagePeople(req.user)) return res.status(403).json({ error: "Only your company IT contact can see account types" });
    const policy = await getLicensePolicy(clientId);
    const assigned = new Map((await listUserAccounts(clientId)).map((a) => [a.userId, a]));
    const people = deps
      .listClientUsers(clientId)
      .filter((u) => u.clientId === clientId && u.isActive !== false)
      .map((u) => {
        const a = assigned.get(u.id);
        const who = { accountType: (a?.accountType ?? "standard") as AccountType, tier: a?.tier ?? null };
        return {
          userId: u.id,
          name: u.fullName,
          email: u.email,
          accountType: who.accountType,
          tier: who.tier,
          assigned: Boolean(a),
          base: policy.platforms.map(({ platform }) => {
            const r = resolveBaseLicense(policy, platform, who);
            return { platform, license: r.license?.name ?? null, assignment: r.assignment };
          }),
        };
      });
    res.json({ success: true, tiers: policy.tiers, people });
  });

  app.put("/api/portal/licensing/people/:userId", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    if (!deps.canManagePeople(req.user)) return res.status(403).json({ error: "Only your company IT contact can change account types" });
    const target = deps.findUser(req.params.userId);
    if (!target || target.clientId !== clientId) return res.status(404).json({ error: "Person not found" });
    const accountType = String(req.body?.accountType || "");
    if (!ACCOUNT_TYPE_KEYS.has(accountType)) return res.status(400).json({ error: "Unknown account type" });
    const policy = await getLicensePolicy(clientId);
    const tierRaw = req.body?.tier;
    const tier = typeof tierRaw === "string" && tierRaw.trim() ? tierRaw.trim() : null;
    if (tier && !policy.tiers.includes(tier)) return res.status(400).json({ error: "That tier is not in your company's licence policy" });
    const saved = await setUserAccount({ userId: target.id, clientId, accountType: accountType as AccountType, tier, updatedBy: req.user!.id });
    res.json({ success: true, account: saved });
  });

  app.get("/api/portal/admin/licensing/policy", ...deps.adminGuards, async (req: Request, res: Response) => {
    const clientId = String(req.query.clientId || "").trim();
    if (!clientId || !deps.getClient(clientId)) return res.status(400).json({ error: "clientId required" });
    res.json({ success: true, policy: await getLicensePolicy(clientId), catalog: LICENSE_CATALOG, platforms: LICENSE_PLATFORMS });
  });

  app.put("/api/portal/admin/licensing/policy", ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const clientId = String(req.query.clientId || req.body?.clientId || "").trim();
    if (!clientId || !deps.getClient(clientId)) return res.status(400).json({ error: "clientId required" });
    const checked = validateLicensePolicy(req.body?.policy);
    if (!checked.policy) return res.status(400).json({ error: "The policy has problems", problems: checked.errors });
    await setLicensePolicy(clientId, checked.policy, req.user?.id ?? null);
    res.json({ success: true, policy: checked.policy });
  });
}
