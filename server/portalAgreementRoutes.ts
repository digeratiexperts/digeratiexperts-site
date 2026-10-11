import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Express, Request, RequestHandler, Response } from "express";
import {
  PORTAL_AGREEMENTS,
  agreementGateMode,
  agreementGateStatus,
  welcomeVideoFrom,
  type AgreementGateMode,
  type WelcomeVideo,
} from "@shared/portalAgreements";
import { listCompanySignatureLog, listSignatures, recordSignature } from "./portalAgreementStore";
import { effectiveClientId, type DirectoryClient, type ServiceRequestUser } from "./serviceRequestRoutes";

/**
 * Client Portal agreement gate.
 *
 *   GET  /api/portal/agreements          what this person still has to sign, and the welcome videos
 *   POST /api/portal/agreements/sign     sign some or all of what is outstanding
 *   GET  /api/portal/admin/agreements?clientId=   the company's signature log (DE admin only)
 *
 * The company and the signer always come from the session. Company agreements
 * can be signed only by someone who can bind the company (org admin / company
 * IT contact). DE staff, including while viewing as a company, never sign for
 * a client: their status is reported as exempt.
 */

type AuthedRequest = Request & {
  user?: ServiceRequestUser & { email?: string | null; orgRole?: string | null; isCompanyItContact?: boolean | null };
};

export type AgreementRouteDeps = {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  getClient: (id: string) => DirectoryClient | undefined;
  /** Org admin / company IT contact of their own company. */
  isCompanySigner: (user: AuthedRequest["user"]) => boolean;
  /** Reads a published PDF by its public path; null when missing. */
  readPdf?: (publicPath: string) => Promise<Buffer | null>;
  mode?: () => AgreementGateMode;
  videos?: () => { company: WelcomeVideo; user: WelcomeVideo };
};

const PUBLIC_ROOTS = [path.resolve(process.cwd(), "dist/public"), path.resolve(process.cwd(), "client/public")];

async function readPublicPdf(publicPath: string): Promise<Buffer | null> {
  const rel = publicPath.replace(/^\/+/, "");
  for (const root of PUBLIC_ROOTS) {
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep)) return null;
    try {
      return await readFile(full);
    } catch {
      /* try the next root */
    }
  }
  return null;
}

const defaultVideos = () => ({
  company: welcomeVideoFrom("company", process.env.PORTAL_WELCOME_VIDEO_COMPANY_URL),
  user: welcomeVideoFrom("user", process.env.PORTAL_WELCOME_VIDEO_USER_URL),
});

export function registerPortalAgreementRoutes(app: Express, deps: AgreementRouteDeps): void {
  const mode = deps.mode ?? (() => agreementGateMode(process.env.PORTAL_AGREEMENT_GATE));
  const videos = deps.videos ?? defaultVideos;
  const readPdf = deps.readPdf ?? readPublicPdf;
  const hashes = new Map<string, string | null>();
  const pdfHash = async (publicPath: string) => {
    if (!hashes.has(publicPath)) {
      const buf = await readPdf(publicPath);
      hashes.set(publicPath, buf ? createHash("sha256").update(buf).digest("hex") : null);
    }
    return hashes.get(publicPath) ?? null;
  };

  app.get("/api/portal/agreements", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const clientId = effectiveClientId(user);
    const client = clientId ? deps.getClient(clientId) : undefined;
    const exempt = user.role === "admin";
    if (!client && !exempt) {
      return res.status(400).json({ error: "Your account is not linked to a company yet." });
    }
    const signer = !exempt && deps.isCompanySigner(user);
    const sigs = client ? await listSignatures(client.id, user.id) : { company: [], user: [] };
    const status = agreementGateStatus({ company: sigs.company, user: exempt ? [] : sigs.user, isCompanySigner: signer });
    res.json({
      success: true,
      mode: mode(),
      exempt,
      company: client ? { id: client.id, name: client.companyName } : null,
      signer: { name: user.fullName || "", email: user.email || "" },
      status: exempt ? { ...status, complete: true, canFinish: false } : status,
      videos: videos(),
    });
  });

  app.post("/api/portal/agreements/sign", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (user.role === "admin") {
      return res.status(403).json({ error: "Agreements are signed by the client. DE staff cannot sign on a company's behalf." });
    }
    const clientId = effectiveClientId(user);
    const client = clientId ? deps.getClient(clientId) : undefined;
    if (!client) return res.status(400).json({ error: "Your account is not linked to a company yet." });

    const body = req.body ?? {};
    const keys: unknown = body.keys;
    const signerName = typeof body.signerName === "string" ? body.signerName.trim().replace(/\s+/g, " ") : "";
    if (body.accept !== true) return res.status(400).json({ error: "Tick the box to confirm you agree." });
    if (signerName.length < 2 || signerName.length > 120) return res.status(400).json({ error: "Type your full name to sign." });
    if (!Array.isArray(keys) || keys.length === 0 || keys.some((k) => typeof k !== "string")) {
      return res.status(400).json({ error: "Choose at least one agreement to sign." });
    }

    const signer = deps.isCompanySigner(user);
    const sigs = await listSignatures(client.id, user.id);
    const status = agreementGateStatus({ company: sigs.company, user: sigs.user, isCompanySigner: signer });
    const byKey = new Map(status.items.map((i) => [i.key, i]));
    for (const key of keys as string[]) {
      const item = byKey.get(key);
      if (!item) return res.status(400).json({ error: `Unknown agreement: ${key}` });
      if (item.state === "signed") continue;
      if (!item.canSign) {
        return res.status(403).json({ error: `${item.title} is signed once for the company by an org admin or your company IT contact.` });
      }
    }

    const ip = (req.ip || req.socket?.remoteAddress || "").slice(0, 64) || null;
    const userAgent = (req.get("user-agent") || "").slice(0, 400) || null;
    for (const key of new Set(keys as string[])) {
      const item = byKey.get(key)!;
      if (item.state === "signed") continue;
      await recordSignature({
        key: item.key,
        version: item.version,
        scope: item.scope,
        clientId: client.id,
        userId: user.id,
        signerName,
        signerEmail: user.email || "",
        documentSha256: await pdfHash(item.pdf),
        ipAddress: ip,
        userAgent,
      });
    }

    const after = await listSignatures(client.id, user.id);
    res.json({ success: true, status: agreementGateStatus({ company: after.company, user: after.user, isCompanySigner: signer }) });
  });

  app.get("/api/portal/admin/agreements", ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const clientId = String(req.query.clientId || "").trim() || effectiveClientId(req.user);
    const client = clientId ? deps.getClient(clientId) : undefined;
    if (!client) return res.status(400).json({ error: "Choose a company." });
    res.json({
      success: true,
      company: { id: client.id, name: client.companyName },
      agreements: PORTAL_AGREEMENTS,
      signatures: await listCompanySignatureLog(client.id),
    });
  });
}
