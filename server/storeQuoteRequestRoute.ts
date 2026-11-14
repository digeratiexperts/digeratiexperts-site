import type { Request, RequestHandler } from "express";
import { canonicalizeQuoteItems, type CanonicalQuoteLine } from "./storeQuoteCommerce";
import {
  resolveClientPricingRows,
  StoreClientPricingUnavailableError,
  toPriceOverrides,
} from "./storeClientPricing";
import { sendStorePricingUnavailable } from "./storeClientPricingHttp";
import { insertQuoteRequest, type StoredQuoteRequest } from "./storeQuoteStore";

export type StoreQuoteRequest = Request & {
  userId?: string;
  user?: {
    id?: string;
    email?: string;
    clientId?: string | null;
  };
  portalClientContext?: {
    clientId: string | null;
    companyName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    primaryContact: string | null;
    impersonating: boolean;
  };
};

export type StoreQuoteCreatedContext = {
  req: StoreQuoteRequest;
  quoteRequest: StoredQuoteRequest;
  canonicalItems: CanonicalQuoteLine[];
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  companyName?: string | null;
  message?: string | null;
};

type StoreQuoteRequestDependencies = {
  resolveClientPricingRows?: typeof resolveClientPricingRows;
  insertQuoteRequest?: typeof insertQuoteRequest;
  onCreated?: (context: StoreQuoteCreatedContext) => void;
};

export function createStoreQuoteRequestHandler(
  dependencies: StoreQuoteRequestDependencies = {},
): RequestHandler {
  const resolvePricing = dependencies.resolveClientPricingRows || resolveClientPricingRows;
  const insertQuote = dependencies.insertQuoteRequest || insertQuoteRequest;

  return async (request, res) => {
    const req = request as StoreQuoteRequest;
    try {
      const {
        contactName: suppliedContactName,
        contactEmail: suppliedContactEmail,
        contactPhone: suppliedContactPhone,
        companyName: suppliedCompanyName,
        message,
        requestedItems,
      } = req.body || {};

      const impersonating = !!req.portalClientContext?.impersonating;
      const clientId = impersonating
        ? req.portalClientContext?.clientId || null
        : req.portalClientContext?.clientId || req.user?.clientId || null;
      const contactName = impersonating
        ? req.portalClientContext?.primaryContact || req.portalClientContext?.companyName || ""
        : suppliedContactName;
      const contactEmail = impersonating
        ? req.portalClientContext?.contactEmail || ""
        : suppliedContactEmail;
      const contactPhone = impersonating
        ? req.portalClientContext?.contactPhone || null
        : suppliedContactPhone;
      const companyName = impersonating
        ? req.portalClientContext?.companyName || ""
        : suppliedCompanyName;

      if (impersonating && (!clientId || !contactName || !contactEmail || !companyName)) {
        res.status(409).json({
          error: "The active client must have authoritative company and contact details before a quote can be submitted",
        });
        return;
      }

      if (!contactName || !contactEmail) {
        res.status(400).json({ error: "Contact name and email are required" });
        return;
      }

      const pricingRows = await resolvePricing(clientId);
      let canonicalItems: CanonicalQuoteLine[];
      try {
        canonicalItems = canonicalizeQuoteItems(requestedItems, toPriceOverrides(pricingRows));
      } catch (error: any) {
        res.status(400).json({ error: error?.message || "Invalid quote items" });
        return;
      }

      const quoteRequest = await insertQuote({
        userId: req.userId || null,
        clientId,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        companyName: companyName || null,
        message: message || null,
        requestedItems: canonicalItems,
      });

      console.log(`[QUOTE REQUEST] Created: ${quoteRequest.quoteNumber} for ${contactEmail}`);
      dependencies.onCreated?.({
        req,
        quoteRequest,
        canonicalItems,
        contactName,
        contactEmail,
        contactPhone,
        companyName,
        message,
      });

      res.json({
        id: quoteRequest.id,
        quoteNumber: quoteRequest.quoteNumber,
        pdfUrl: `/api/store/quote-requests/${quoteRequest.id}/pdf`,
        message: "Quote request submitted successfully",
      });
    } catch (error: any) {
      console.error("[CREATE QUOTE REQUEST ERROR]", error);
      if (error instanceof StoreClientPricingUnavailableError) {
        sendStorePricingUnavailable(
          res,
          "Quote pricing is temporarily unavailable. Please retry shortly.",
        );
        return;
      }
      res.status(500).json({ error: error?.message || "Failed to create quote request" });
    }
  };
}
