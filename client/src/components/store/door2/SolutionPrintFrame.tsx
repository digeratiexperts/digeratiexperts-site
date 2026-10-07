import type { ReactNode } from "react";
import { COMPANY, PRIMARY_PHONE } from "@/data/companyContact";
import { DE_LOGO_PRIMARY } from "@/lib/brandAssets";

/**
 * The browser-print frame around a solution sheet. On screen it renders the
 * sheet alone. On paper it adds the letterhead and the close the branded
 * packet PDF carries (server/pdf/solutionPacketPdf.ts), so printing the page
 * itself never yields an unbranded sheet (#526).
 */
export function SolutionPrintFrame({
  status,
  reference,
  children,
}: {
  status: "Draft" | "Submitted";
  reference?: string;
  children: ReactNode;
}) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <>
      <div className="d2-print-only d2-print-head" data-testid="solution-print-head">
        <img src={DE_LOGO_PRIMARY} alt="Digerati Experts" className="d2-print-head__logo" />
        <div className="d2-print-head__meta">
          <p className="d2-print-head__title">Your Solution</p>
          <p>
            {status}
            {reference ? ` · ${reference}` : ""} · {date}
          </p>
        </div>
      </div>
      {children}
      <div className="d2-print-only d2-print-close" data-testid="solution-print-close">
        <p className="d2-print-close__heading">A consultant reviews your solution</p>
        <p>
          This summary restates the solution you assembled on digeratiexperts.com. It is not a signed commercial
          offer. A Digerati Experts consultant confirms scope, pricing, and next steps after review.
        </p>
        <p className="d2-print-close__contact">
          {PRIMARY_PHONE.display} · {COMPANY.email} · digeratiexperts.com
        </p>
      </div>
    </>
  );
}
