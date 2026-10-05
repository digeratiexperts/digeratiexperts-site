import { useEffect, useState } from "react";

export type StripeTaxReadinessStatus = "READY" | "NOT_CONFIGURED" | "AUTH_REQUIRED" | "INCOMPLETE" | "UNKNOWN";

export type StripeTaxReadiness = {
  status: StripeTaxReadinessStatus;
  checks: {
    key: "set" | "missing";
    originAddress: "set" | "missing" | "unknown";
    arizona: "active" | "missing" | "unknown";
  };
  message: string;
  quoteOnlyCategories: string[];
  checkedAt: string;
};

/** Short label for the staff checkout line. */
export const STRIPE_TAX_STATUS_LABEL: Record<StripeTaxReadinessStatus, string> = {
  READY: "Sales tax ready",
  NOT_CONFIGURED: "Sales tax paused",
  AUTH_REQUIRED: "Sales tax key rejected",
  INCOMPLETE: "Sales tax setup incomplete",
  UNKNOWN: "Sales tax status unknown",
};

/** One plain sentence for staff on the checkout; the Vendors page carries the setup detail. */
export function checkoutTaxNote(readiness: StripeTaxReadiness): string {
  switch (readiness.status) {
    case "READY":
      return "Stripe Tax adds sales tax when you pay.";
    case "NOT_CONFIGURED":
      return "Pay Now switches to a quote until Stripe Tax is set up.";
    case "AUTH_REQUIRED":
      return "Pay Now switches to a quote until the Stripe Tax key is replaced.";
    case "INCOMPLETE":
      return readiness.checks.originAddress === "missing"
        ? "Pay Now switches to a quote until Stripe Tax has DE's origin address."
        : "Arizona clients switch to a quote until Arizona is registered in Stripe Tax.";
    default:
      return "If sales tax cannot be calculated, Pay Now switches to a quote.";
  }
}

/**
 * Staff Pay Now sales tax readiness (server/services/stripeTaxReadiness.ts).
 * Honest statuses only: a failed check reads UNKNOWN, never READY.
 */
export function useStripeTaxReadiness(): StripeTaxReadiness | null {
  const [readiness, setReadiness] = useState<StripeTaxReadiness | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/warehouse/tax-status", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as StripeTaxReadiness;
      })
      .then((json) => {
        if (!cancelled) setReadiness(json);
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness({
            status: "UNKNOWN",
            checks: { key: "set", originAddress: "unknown", arizona: "unknown" },
            message: "Could not read the sales tax status from this site. Pay Now still switches to a quote if tax cannot be calculated.",
            quoteOnlyCategories: [],
            checkedAt: new Date().toISOString(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return readiness;
}
