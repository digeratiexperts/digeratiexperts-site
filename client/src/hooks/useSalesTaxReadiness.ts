import { useEffect, useState } from "react";

export type SalesTaxReadinessStatus = "READY" | "NOT_CONFIGURED" | "AUTH_REQUIRED" | "INCOMPLETE" | "UNKNOWN";
type Check = "set" | "missing" | "unknown";

export type SalesTaxReadiness = {
  status: SalesTaxReadinessStatus;
  provider: "zoho_books";
  checks: {
    connection: "set" | "missing";
    taxRegistration: "active" | "missing" | "unknown";
    serviceItem: Check;
    taxContact: Check;
  };
  message: string;
  missingSettings: string[];
  quoteOnlyCategories: string[];
  checkedAt: string;
};

/** Short label for the staff checkout line. */
export const SALES_TAX_STATUS_LABEL: Record<SalesTaxReadinessStatus, string> = {
  READY: "Sales tax ready",
  NOT_CONFIGURED: "Sales tax paused",
  AUTH_REQUIRED: "Zoho Books token rejected",
  INCOMPLETE: "Sales tax setup incomplete",
  UNKNOWN: "Sales tax status unknown",
};

/** One plain sentence for staff on the checkout; the Vendors page carries the setup detail. */
export function checkoutTaxNote(readiness: SalesTaxReadiness): string {
  switch (readiness.status) {
    case "READY":
      return "Zoho Books adds sales tax when you pay.";
    case "NOT_CONFIGURED":
      return "Pay Now switches to a quote until the site is connected to Zoho Books.";
    case "AUTH_REQUIRED":
      return "Pay Now switches to a quote until the Zoho Books token is replaced.";
    case "INCOMPLETE":
      return readiness.checks.taxRegistration === "missing"
        ? "Pay Now switches to a quote until Sales Tax Automation is on in Zoho Books."
        : "Pay Now switches to a quote until the Zoho Books tax item and contact are set.";
    default:
      return "If sales tax cannot be calculated, Pay Now switches to a quote.";
  }
}

/**
 * Staff Pay Now sales tax readiness (server/services/salesTaxReadiness.ts).
 * Honest statuses only: a failed check reads UNKNOWN, never READY.
 */
export function useSalesTaxReadiness(): SalesTaxReadiness | null {
  const [readiness, setReadiness] = useState<SalesTaxReadiness | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/warehouse/tax-status", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as SalesTaxReadiness;
      })
      .then((json) => {
        if (!cancelled) setReadiness(json);
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness({
            status: "UNKNOWN",
            provider: "zoho_books",
            checks: { connection: "set", taxRegistration: "unknown", serviceItem: "unknown", taxContact: "unknown" },
            message: "Could not read the sales tax status from this site. Pay Now still switches to a quote if tax cannot be calculated.",
            missingSettings: [],
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
