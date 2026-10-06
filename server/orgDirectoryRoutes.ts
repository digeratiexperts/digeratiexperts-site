import type { Express, Request, RequestHandler, Response } from "express";
import {
  companyIdHolders,
  ensurePerson,
  getOrgProfile,
  listPeople,
  listUnitLeaders,
  setOrgProfile,
  setUnitLeader,
  updatePerson,
  type PersonPatch,
} from "./orgDirectoryStore";
import { isItContact, personContext, type OrgRoutingDeps } from "./orgRouting";
import { effectiveClientId, listClientSites, type ServiceRequestUser } from "./serviceRequestRoutes";
import {
  checkCompanyPersonId,
  displayPersonId,
  orgProfileSchema,
  parseCsv,
  planImport,
  unitLeaderSchema,
  type UnitKind,
} from "@shared/orgDirectory";

/**
 * Company structure and people directory in the Client Portal.
 *
 *   GET  /api/portal/directory/me                     my IDs, my site / department and its leader, my availability
 *   PUT  /api/portal/directory/me/availability        mark myself away until a date (or back)
 *   GET  /api/portal/directory                        structure, leaders, everyone's IDs and tier (managers)
 *   PUT  /api/portal/directory/profile                structure, ID scheme, approval settings (managers)
 *   PUT  /api/portal/directory/leaders                one site / department's leader and backup (managers)
 *   PUT  /api/portal/directory/people/:userId         a person's company ID, site, tier, away date (managers)
 *   POST /api/portal/directory/import                 CSV of company IDs / sites / VIPs; preview, then apply (managers)
 *
 * Managers are the company IT contact or org admin of their own company, or a
 * DE admin with the company open. The company always comes from the session.
 */

type AuthedRequest = Request & { user?: ServiceRequestUser & { orgRole?: string | null; isCompanyItContact?: boolean | null } };

export type OrgDirectoryRouteDeps = OrgRoutingDeps & {
  guards: RequestHandler[];
  canManage: (user: AuthedRequest["user"]) => boolean;
  /** Move a person to a department (the existing portal org field). Needed for department imports. */
  setDepartment?: (userId: string, departmentId: string | null) => Promise<unknown>;
  now?: () => Date;
};

const today = (d: Date) => d.toISOString().slice(0, 10);

export function registerOrgDirectoryRoutes(app: Express, deps: OrgDirectoryRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();

  const company = (req: AuthedRequest, res: Response, manage = false): string | null => {
    const clientId = effectiveClientId(req.user);
    if (!clientId || !deps.getClient(clientId)) {
      res.status(400).json({ error: req.user?.role === "admin" ? "Open a company (impersonate) first." : "Your account is not linked to a company yet." });
      return null;
    }
    if (manage && !deps.canManage(req.user)) {
      res.status(403).json({ error: "Only your company IT contact can change this" });
      return null;
    }
    return clientId;
  };

  const inCompany = (clientId: string, userId: unknown) => {
    if (typeof userId !== "string" || !userId) return null;
    const u = deps.findUser(userId);
    return u && u.clientId === clientId && u.isActive !== false ? u : null;
  };

  async function units(clientId: string): Promise<Array<{ kind: UnitKind; id: string; name: string; code?: string }>> {
    const sites = (await listClientSites(clientId, deps.getClient(clientId) as any)).map((s) => ({ kind: "site" as const, id: s.id, name: s.name || s.code, code: s.code }));
    const depts = deps.listDepartments ? (await deps.listDepartments(clientId).catch(() => [])).map((d) => ({ kind: "department" as const, id: d.id, name: d.name })) : [];
    return [...sites, ...depts];
  }

  app.get("/api/portal/directory/me", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    const me = inCompany(clientId, req.user!.id);
    if (!me) return res.status(404).json({ error: "You are not in this company's directory" });
    const ctx = await personContext(deps, clientId, me.id);
    const leads = (await listUnitLeaders(clientId)).filter((l) => l.leaderUserId === me.id || l.backupUserId === me.id);
    const all = await units(clientId);
    res.json({
      success: true,
      structure: ctx.profile.structure,
      companyIdLabel: ctx.profile.companyIdLabel,
      me: {
        userId: me.id,
        name: me.fullName,
        personId: ctx.personId,
        dePersonId: ctx.person.dePersonId,
        companyPersonId: ctx.person.companyPersonId,
        supportTier: ctx.person.supportTier,
        awayUntil: ctx.person.awayUntil,
      },
      unit: ctx.unit,
      leader: ctx.leader,
      backup: ctx.backup,
      leads: leads.map((l) => ({ ...l, name: all.find((u) => u.kind === l.unitKind && u.id === l.unitId)?.name ?? "", role: l.leaderUserId === me.id ? "leader" : "backup" })),
      canManage: deps.canManage(req.user),
    });
  });

  app.put("/api/portal/directory/me/availability", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res);
    if (!clientId) return;
    const me = inCompany(clientId, req.user!.id);
    if (!me) return res.status(404).json({ error: "You are not in this company's directory" });
    const raw = req.body?.awayUntil;
    const t = today(now());
    let awayUntil: string | null = null;
    if (raw !== null && raw !== undefined && raw !== "") {
      if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return res.status(400).json({ error: "Use a date (YYYY-MM-DD)" });
      if (raw < t) return res.status(400).json({ error: "Choose today or a later date" });
      awayUntil = raw;
    }
    const profile = await getOrgProfile(clientId, deps.getClient(clientId)!.companyName);
    await ensurePerson(me.id, clientId, profile.idPrefix);
    const saved = await updatePerson(me.id, clientId, { awayUntil }, me.id);
    res.json({ success: true, awayUntil: saved.awayUntil });
  });

  app.get("/api/portal/directory", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res, true);
    if (!clientId) return;
    const profile = await getOrgProfile(clientId, deps.getClient(clientId)!.companyName);
    const leaders = await listUnitLeaders(clientId);
    const all = await units(clientId);
    const people = [];
    for (const u of deps.listClientUsers(clientId).filter((x) => x.clientId === clientId && x.isActive !== false)) {
      const p = await ensurePerson(u.id, clientId, profile.idPrefix);
      people.push({
        userId: u.id,
        name: u.fullName,
        email: u.email,
        personId: displayPersonId(profile, p),
        dePersonId: p.dePersonId,
        companyPersonId: p.companyPersonId,
        siteId: p.siteId,
        departmentId: u.departmentId ?? null,
        supportTier: p.supportTier,
        awayUntil: p.awayUntil,
        isItContact: isItContact(u),
      });
    }
    people.sort((a, b) => a.name.localeCompare(b.name));
    const shown = all.filter((x) => x.kind === profile.structure);
    res.json({
      success: true,
      profile,
      units: shown.map((x) => {
        const l = leaders.find((y) => y.unitKind === x.kind && y.unitId === x.id);
        return { ...x, leaderUserId: l?.leaderUserId ?? null, backupUserId: l?.backupUserId ?? null, ccLeader: l?.ccLeader ?? true };
      }),
      sites: all.filter((x) => x.kind === "site"),
      departments: all.filter((x) => x.kind === "department"),
      people,
    });
  });

  app.put("/api/portal/directory/profile", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res, true);
    if (!clientId) return;
    const parsed = orgProfileSchema.safeParse(req.body?.profile);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please fix the highlighted settings", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) });
    }
    // A naming rule must not strand IDs people already hold.
    if (parsed.data.companyIdPattern) {
      for (const p of await listPeople(clientId)) {
        if (p.companyPersonId && checkCompanyPersonId(parsed.data, p.companyPersonId)) {
          return res.status(400).json({ error: `Existing ${parsed.data.companyIdLabel} "${p.companyPersonId}" doesn't match ${parsed.data.companyIdPattern}. Fix it first.` });
        }
      }
    }
    await setOrgProfile(clientId, parsed.data, req.user!.id);
    res.json({ success: true, profile: parsed.data });
  });

  app.put("/api/portal/directory/leaders", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res, true);
    if (!clientId) return;
    const parsed = unitLeaderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a site or department" });
    const l = parsed.data;
    const all = await units(clientId);
    if (!all.some((x) => x.kind === l.unitKind && x.id === l.unitId)) return res.status(404).json({ error: "That site or department isn't in your company" });
    if (l.leaderUserId && !inCompany(clientId, l.leaderUserId)) return res.status(400).json({ error: "The leader must be an active person in your company" });
    if (l.backupUserId && !inCompany(clientId, l.backupUserId)) return res.status(400).json({ error: "The backup must be an active person in your company" });
    if (l.leaderUserId && l.leaderUserId === l.backupUserId) return res.status(400).json({ error: "Choose a different person as the backup" });
    if (!l.leaderUserId && l.backupUserId) return res.status(400).json({ error: "Choose a leader before a backup" });
    await setUnitLeader(clientId, l, req.user!.id);
    res.json({ success: true, leader: l });
  });

  async function checkPersonPatch(clientId: string, userId: string, body: any): Promise<{ patch?: PersonPatch; error?: string }> {
    const profile = await getOrgProfile(clientId, deps.getClient(clientId)!.companyName);
    const patch: PersonPatch = {};
    if (body?.companyPersonId !== undefined) {
      const v = typeof body.companyPersonId === "string" ? body.companyPersonId.trim() : "";
      if (v) {
        const bad = checkCompanyPersonId(profile, v);
        if (bad) return { error: bad };
        const holder = (await companyIdHolders(clientId)).get(v.toLowerCase());
        if (holder && holder !== userId) return { error: `${profile.companyIdLabel} ${v} already belongs to someone else` };
      }
      patch.companyPersonId = v || null;
    }
    if (body?.siteId !== undefined) {
      const v = typeof body.siteId === "string" && body.siteId ? body.siteId : null;
      if (v && !(await units(clientId)).some((x) => x.kind === "site" && x.id === v)) return { error: "That site isn't in your company" };
      patch.siteId = v;
    }
    if (body?.supportTier !== undefined) {
      if (body.supportTier !== "vip" && body.supportTier !== "standard") return { error: "Support tier is VIP or standard" };
      patch.supportTier = body.supportTier;
    }
    if (body?.awayUntil !== undefined) {
      const v = body.awayUntil;
      if (v !== null && v !== "" && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))) return { error: "Away until must be a date" };
      patch.awayUntil = v || null;
    }
    return { patch };
  }

  app.put("/api/portal/directory/people/:userId", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res, true);
    if (!clientId) return;
    const target = inCompany(clientId, req.params.userId);
    if (!target) return res.status(404).json({ error: "Person not found" });
    const checked = await checkPersonPatch(clientId, target.id, req.body);
    if (!checked.patch) return res.status(400).json({ error: checked.error });
    const profile = await getOrgProfile(clientId, deps.getClient(clientId)!.companyName);
    await ensurePerson(target.id, clientId, profile.idPrefix);
    const saved = await updatePerson(target.id, clientId, checked.patch, req.user!.id);
    res.json({ success: true, person: { ...saved, personId: displayPersonId(profile, saved) } });
  });

  app.post("/api/portal/directory/import", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const clientId = company(req, res, true);
    if (!clientId) return;
    const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
    if (!csv.trim()) return res.status(400).json({ error: "Paste or upload a CSV file" });
    if (csv.length > 2_000_000) return res.status(400).json({ error: "The file is too large (2 MB at most)" });
    const profile = await getOrgProfile(clientId, deps.getClient(clientId)!.companyName);
    const users = deps.listClientUsers(clientId).filter((u) => u.clientId === clientId && u.isActive !== false);
    const unitList = (await units(clientId)).filter((x) => x.kind === profile.structure);
    const plan = planImport({ rows: parseCsv(csv), profile, users, existingIds: await companyIdHolders(clientId), units: unitList });
    const rowErrors = plan.rows.filter((r) => r.errors.length).length;
    const apply = req.body?.apply === true;
    if (!apply || plan.errors.length || rowErrors) {
      return res.json({ success: true, applied: 0, ...plan, rowErrors, canApply: !plan.errors.length && !rowErrors && plan.rows.length > 0 });
    }
    // Two passes, so an ID moving from one person to another in the same file doesn't collide.
    for (const row of plan.rows) {
      await ensurePerson(row.userId!, clientId, profile.idPrefix);
      if (row.companyPersonId) await updatePerson(row.userId!, clientId, { companyPersonId: null }, req.user!.id);
    }
    let applied = 0;
    for (const row of plan.rows) {
      const patch: PersonPatch = {};
      if (plan.columns.companyPersonId !== undefined) patch.companyPersonId = row.companyPersonId;
      if (row.unitId && profile.structure === "site") patch.siteId = row.unitId;
      if (row.unitId && profile.structure === "department" && deps.setDepartment) await deps.setDepartment(row.userId!, row.unitId);
      if (row.supportTier) patch.supportTier = row.supportTier;
      if (row.awayUntil) patch.awayUntil = row.awayUntil;
      await updatePerson(row.userId!, clientId, patch, req.user!.id);
      applied += 1;
    }
    res.json({ success: true, applied, ...plan, rowErrors: 0, canApply: false });
  });
}
