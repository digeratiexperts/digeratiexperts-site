import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  getFamilyById,
  publicSolutionFamilies,
  slugToFamilyId,
  toPublicFamily,
} from "../client/src/lib/businessNeeds";
import { eventBus, EventTypes } from "./eventBus";
import { buildPublicSolutionRequestDescription, syncPublicSolutionRequestToCrm } from "./publicSolutionRequestCrm";
import {
  createPublicSolutionRequest,
  findPublicSolutionRequestDurable,
  getPublicSolutionRequestDurable,
  markPublicSolutionRequestCrmDurable,
  publicFamilyExists,
  publicSolutionRequestView,
  submitPublicSolutionRequestDurable,
  unsubmitPublicSolutionRequest,
  upsertPublicSolutionRequestDurable,
  type PublicSolutionRequest,
} from "./publicSolutionRequestStore";

const SESSION_COOKIE = "de_solution_request";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

/**
 * Every accepted submission creates a lead, an admin email and an outbox row,
 * so the public POST gets its own ceiling. Twenty an hour per address is far
 * above any real buyer and far below a script. Tests run many submits from one
 * address inside a minute and are exempt.
 */
const submitRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.VITEST === "true",
  message: { error: "Too many submissions from this connection. Please try again later." },
});

/**
 * Memory-only acceptance is a development and smoke-test convenience, never a
 * production behaviour: the same pass the health probe honours.
 */
function memoryOnlySubmissionAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DE_SMOKE_ALLOW_MEMORY_ONLY === "1";
}

function readSessionId(req: Request): string {
  const fromCookie = typeof req.cookies?.[SESSION_COOKIE] === "string" ? req.cookies[SESSION_COOKIE] : "";
  const fromBody = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const fromQuery = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  return (fromCookie || fromBody || fromQuery).trim().slice(0, 80);
}

function ensureSession(req: Request, res: Response): string {
  // Drafts and submissions carry contact details; nothing here is cacheable.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Cookie");
  const existing = readSessionId(req);
  if (existing) {
    res.cookie(SESSION_COOKIE, existing, SESSION_COOKIE_OPTIONS);
    return existing;
  }
  const sessionId = randomUUID();
  res.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
  return sessionId;
}

function genericNotFound(res: Response) {
  return res.status(404).json({ error: "Not found" });
}

function requestInput(req: Request, sessionId: string) {
  return {
    sessionId,
    id: typeof req.body?.id === "string" ? req.body.id : undefined,
    familyId: req.body?.familyId,
    offerId: req.body?.offerId,
    deliveryModel: req.body?.deliveryModel,
    deliveryPreference: req.body?.deliveryPreference,
    selectedNeeds: req.body?.selectedNeeds,
    environment: req.body?.environment,
    fulfillment: req.body?.fulfillment,
    intent: req.body?.intent,
    organizationName: req.body?.organizationName,
    contactName: req.body?.contactName,
    contactEmail: req.body?.contactEmail,
    contactPhone: req.body?.contactPhone,
    notes: req.body?.notes,
  };
}

export function registerPublicSolutionRoutes(app: Express): void {
  app.get("/api/public/solutions/families", (_req, res) => {
    res.json({ families: publicSolutionFamilies() });
  });

  app.get("/api/public/solutions/families/:id", (req, res) => {
    const raw = String(req.params.id || "");
    const familyId = slugToFamilyId(raw) || (publicFamilyExists(raw) ? raw : null);
    const family = familyId ? getFamilyById(familyId) : null;
    if (!family) return genericNotFound(res);
    return res.json({ family: toPublicFamily(family) });
  });

  app.get("/api/public/solutions/request", async (req, res) => {
    const sessionId = ensureSession(req, res);
    // A "resume" link (?draftId=) lets a visitor continue a saved draft from
    // a different browser/device. The id is an unguessable random UUID, so
    // possession of it is the trust boundary — same model as a Stripe
    // Checkout or Calendly reschedule link. On a hit, this device's session
    // cookie is re-pointed at that draft's own session so subsequent saves
    // update the same row instead of forking a new draft.
    const draftId = typeof req.query.draftId === "string" ? req.query.draftId.trim().slice(0, 80) : "";
    let record: PublicSolutionRequest | undefined;
    let resolvedSessionId = sessionId;
    if (draftId) {
      record = await getPublicSolutionRequestDurable(draftId);
      if (record) resolvedSessionId = record.sessionId;
    }
    if (!record) {
      record = await findPublicSolutionRequestDurable(sessionId);
    }
    if (!record) {
      record = createPublicSolutionRequest(sessionId);
    }
    if (resolvedSessionId !== sessionId) {
      res.cookie(SESSION_COOKIE, resolvedSessionId, SESSION_COOKIE_OPTIONS);
    }
    return res.json({ request: publicSolutionRequestView(record) });
  });

  // Save progress without collecting contact information. This does not create a lead.
  app.put("/api/public/solutions/request", async (req, res) => {
    const sessionId = ensureSession(req, res);
    const record = await upsertPublicSolutionRequestDurable(requestInput(req, sessionId));
    return res.json({ request: publicSolutionRequestView(record) });
  });

  app.post("/api/public/solutions/request", submitRateLimiter, async (req, res) => {
    const sessionId = ensureSession(req, res);
    const organizationName = typeof req.body?.organizationName === "string" ? req.body.organizationName.trim() : "";
    const contactName = typeof req.body?.contactName === "string" ? req.body.contactName.trim() : "";
    const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim() : "";
    const contactPhone = typeof req.body?.contactPhone === "string" ? req.body.contactPhone.trim() : "";
    if (
      organizationName.length < 2 ||
      contactName.length < 2 ||
      !EMAIL_RE.test(contactEmail) ||
      contactPhone.replace(/\D/g, "").length < 7
    ) {
      return res.status(400).json({ error: "Company, name, email, and phone are required." });
    }

    const draft = await upsertPublicSolutionRequestDurable({
      ...requestInput(req, sessionId),
      organizationName,
      contactName,
      contactEmail,
      contactPhone,
    });

    if (!draft.familyId && draft.selectedNeeds.length === 0) {
      return res.status(400).json({ error: "Select at least one business need before submitting." });
    }

    let submitted;
    try {
      submitted = await submitPublicSolutionRequestDurable(
        draft,
        { name: contactName, email: contactEmail, phone: contactPhone, organizationName },
        typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined,
      );
    } catch (error: any) {
      console.error("[solution-request] persist failed", error);
      return res.status(500).json({ error: "We could not save your solution request. Please try again." });
    }

    // A submitted solution is a lead, not disposable UI state. In production a
    // submit that could not be written durably is accepted only if the CRM has
    // recorded it; otherwise the visitor is told to retry and the memory record
    // is rolled back to a draft so the retry is a real submit, not a "replay".
    let durable: "database" | "crm" | "memory" = submitted.persisted ? "database" : "memory";
    let crmSyncedInline = false;
    if (!submitted.persisted && !submitted.replayed && !memoryOnlySubmissionAllowed()) {
      let crmStatus: "pending" | "recorded" = "pending";
      try {
        crmStatus = await syncPublicSolutionRequestToCrm(submitted.record);
      } catch (error: any) {
        console.warn("[solution-request] CRM sync failed while storage was unavailable:", error?.message || error);
      }
      if (crmStatus === "recorded") {
        durable = "crm";
        crmSyncedInline = true;
        await markPublicSolutionRequestCrmDurable(submitted.record.id, "recorded");
      } else {
        unsubmitPublicSolutionRequest(submitted.record.id);
        console.error("[solution-request] DURABLE_STORAGE_REQUIRED", { id: submitted.record.id });
        return res.status(503).json({
          code: "DURABLE_STORAGE_REQUIRED",
          error:
            "We could not save your solution just now. Nothing you entered was lost on this device; please try again in a moment.",
        });
      }
    }

    if (!submitted.replayed) {
      const record = submitted.record;
      // The listener sends the admin email and writes the Hub outbox from
      // these fields; without them the notification read "New Lead: undefined".
      void eventBus.emit(EventTypes.LEAD_CREATED, {
        id: record.id,
        name: record.contactName,
        email: record.contactEmail,
        company: record.organizationName,
        phone: record.contactPhone,
        message: buildPublicSolutionRequestDescription(record),
        source: "solution_request",
        correlationId: record.correlationId,
        familyId: record.familyId,
        offerId: record.offerId,
        deliveryModel: record.deliveryModel,
        deliveryPreference: record.deliveryPreference,
        selectedNeeds: record.selectedNeeds.map((need) => need.familyId),
        installation: record.fulfillment.installation,
        remoteSupport: record.fulfillment.remoteSupport,
        intent: record.intent,
      });
      if (!crmSyncedInline) {
        void syncPublicSolutionRequestToCrm(record)
          .then((crmStatus) => markPublicSolutionRequestCrmDurable(record.id, crmStatus))
          .catch((error: any) => console.warn("[solution-request] CRM follow-up pending:", error?.message || error));
      }
    }

    // A replay must not downgrade a CRM status the first submission already earned.
    const latest = submitted.replayed || crmSyncedInline
      ? await getPublicSolutionRequestDurable(submitted.record.id)
      : await markPublicSolutionRequestCrmDurable(submitted.record.id, "pending");
    const view = publicSolutionRequestView(latest ?? submitted.record);
    return res.json({
      request: view,
      correlationId: view.correlationId,
      crm: view.crmStatus,
      replayed: submitted.replayed,
      durable,
      message: "Your solution was saved. DE will confirm package fit, scope, fulfillment, and pricing before you commit.",
    });
  });
}
