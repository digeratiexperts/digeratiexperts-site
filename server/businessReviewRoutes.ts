import type { Express, Request, RequestHandler, Response } from "express";
import { can, isDeStaff } from "@shared/permissions";
import { selectedPortalCompanyId } from "./portalCompanyProfile";
import { countPublishedReviews, deleteReview, getReview, listReviews, saveReview } from "./businessReviewStore";
import { listRoadmap } from "./roadmapStore";
import { reviewInputSchema, sortReviews, type BusinessReview, type ClientBusinessReview } from "@shared/businessReviews";

/**
 * Business reviews over HTTP.
 *
 * - GET /api/portal/business-reviews: the session company's published
 *   reviews (owners, reviews.read), with roadmap links and the report file
 *   resolved from that company's own records only.
 * - /api/portal/admin/companies/:companyId/business-reviews: DE list, create,
 *   edit (incl. publish / unpublish), delete (reviews.manage).
 */

type AuthedRequest = Request & { user?: any };
export type TenantFile = { id: string; fileName?: string; originalName?: string; fileUrl?: string };

export type BusinessReviewRouteDeps = {
  guards: RequestHandler[];
  /** Must enforce reviews.manage for the :companyId in the path. */
  adminGuards: RequestHandler[];
  getClient: (id: string) => { id: string; companyName: string } | undefined;
  findUser: (id: string) => { id: string; fullName?: string; email?: string } | undefined;
  /** The company's shared files (Files & Downloads). */
  listCompanyFiles: (clientId: string) => Promise<TenantFile[]>;
  now?: () => Date;
};

export const REVIEWS_PATH = "/api/portal/business-reviews";
export const ADMIN_REVIEWS_PATH = "/api/portal/admin/companies/:companyId/business-reviews";

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join(".") || "form", i.message]));

export const companyHasPublishedReview = async (clientId: string) => (await countPublishedReviews(clientId)) > 0;

const fileLabel = (f: TenantFile) => f.originalName || f.fileName || "Review report";

export function registerBusinessReviewRoutes(app: Express, deps: BusinessReviewRouteDeps): void {
  const now = () => (deps.now ?? (() => new Date()))();
  const nameOf = (req: AuthedRequest) => {
    const u = req.user?.id ? deps.findUser(req.user.id) : undefined;
    return u?.fullName || u?.email || (isDeStaff(req.user) ? "Digerati Experts" : "Your team");
  };

  /** Resolve links against this company's own roadmap and files; anything else is dropped. */
  const resolve = async (clientId: string, reviews: BusinessReview[]): Promise<ClientBusinessReview[]> => {
    const [roadmap, files] = await Promise.all([listRoadmap(clientId), deps.listCompanyFiles(clientId).catch(() => [] as TenantFile[])]);
    const items = new Map(roadmap.map((i) => [i.id, i]));
    const fileById = new Map(files.map((f) => [String(f.id), f]));
    return reviews.map(({ clientId: _c, roadmapItemIds, fileId, status: _s, ...rest }) => {
      const file = fileId ? fileById.get(fileId) : undefined;
      return {
        ...rest,
        roadmapItems: roadmapItemIds.flatMap((id) => {
          const i = items.get(id);
          return i ? [{ id: i.id, title: i.title, status: i.status }] : [];
        }),
        report: file && file.fileUrl ? { fileName: fileLabel(file), url: file.fileUrl } : null,
      };
    });
  };

  app.get(REVIEWS_PATH, ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const id = selectedPortalCompanyId(req.user);
    const client = id ? deps.getClient(id) : undefined;
    if (!client) {
      return res.status(400).json({
        code: id ? "COMPANY_NOT_FOUND" : "COMPANY_CONTEXT_REQUIRED",
        error: id ? "That company record is no longer available." : "Choose a company to see its business reviews.",
      });
    }
    if (!can(req.user, "reviews.read", client.id)) return res.status(403).json({ error: "Only your company's owners can see business reviews." });
    const published = sortReviews((await listReviews(client.id)).filter((r) => r.status === "published"));
    res.json({ success: true, company: { id: client.id, name: client.companyName }, reviews: await resolve(client.id, published) });
  });

  // ---- DE side ----
  const adminCompany = (req: AuthedRequest, res: Response) => {
    const client = deps.getClient(req.params.companyId);
    if (!client) res.status(404).json({ error: "Company not found" });
    return client ?? null;
  };

  /** Validate links: roadmap items and the file must belong to this company. */
  const checkLinks = async (clientId: string, input: { roadmapItemIds: string[]; fileId: string | null }) => {
    const errors: Record<string, string> = {};
    const roadmap = new Set((await listRoadmap(clientId)).map((i) => i.id));
    if (input.roadmapItemIds.some((id) => !roadmap.has(id))) errors.roadmapItemIds = "Link only this company's roadmap items";
    if (input.fileId) {
      const files = await deps.listCompanyFiles(clientId).catch(() => [] as TenantFile[]);
      if (!files.some((f) => String(f.id) === input.fileId)) errors.fileId = "Choose a file shared with this company";
    }
    return errors;
  };

  app.get(ADMIN_REVIEWS_PATH, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    const reviews = sortReviews(await listReviews(client.id));
    res.json({ success: true, company: { id: client.id, name: client.companyName }, reviews });
  });

  const save = async (req: AuthedRequest, res: Response, id: string | null) => {
    const client = adminCompany(req, res);
    if (!client) return;
    let body = req.body ?? {};
    if (id) {
      const current = await getReview(client.id, id);
      if (!current) return res.status(404).json({ error: "Business review not found" });
      body = { ...current, ...body };
    }
    const parsed = reviewInputSchema.safeParse({
      title: body.title,
      period: body.period ?? null,
      meetingOn: body.meetingOn,
      status: body.status,
      summary: body.summary,
      decisions: body.decisions,
      roadmapItemIds: body.roadmapItemIds,
      fileId: body.fileId ?? null,
    });
    if (!parsed.success) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: fieldErrors(parsed.error.issues) });
    const linkErrors = await checkLinks(client.id, parsed.data);
    if (Object.keys(linkErrors).length) return res.status(400).json({ error: "Please fix the highlighted fields", fieldErrors: linkErrors });
    const review = await saveReview(client.id, id, parsed.data, { id: req.user?.id ?? "", name: nameOf(req) }, now());
    if (!review) return res.status(404).json({ error: "Business review not found" });
    res.status(id ? 200 : 201).json({ success: true, review });
  };

  app.post(ADMIN_REVIEWS_PATH, ...deps.adminGuards, (req: AuthedRequest, res: Response) => save(req, res, null));
  app.patch(`${ADMIN_REVIEWS_PATH}/:id`, ...deps.adminGuards, (req: AuthedRequest, res: Response) => save(req, res, req.params.id));

  app.delete(`${ADMIN_REVIEWS_PATH}/:id`, ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const client = adminCompany(req, res);
    if (!client) return;
    if (!(await deleteReview(client.id, req.params.id))) return res.status(404).json({ error: "Business review not found" });
    res.json({ success: true });
  });
}
