import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Loader, Library } from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { format } from "date-fns";
import { PortalLayout } from "./PortalLayout";
import { Callout, EmptyState, Panel, Token, type TokenTone } from "@/components/portal/ui";

interface Contract {
  id: string;
  hubSignatureId?: number;
  contractNumber: string;
  title: string;
  description: string;
  status: string;
  documentType?: string;
  sentAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  countersignedAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
  downloadAvailable?: boolean;
  source?: string;
  accountName?: string;
}

interface LibraryDoc {
  slug: string;
  title: string;
  category: string;
  version: number;
  status: string;
  description?: string | null;
  sendable?: boolean;
}

const statusConfig: Record<string, { label: string; tone: TokenTone }> = {
  pending: { label: "Awaiting signature", tone: "warn" },
  signed: { label: "Partially signed", tone: "info" },
  countersigned: { label: "Fully executed", tone: "ok" },
  expired: { label: "Expired", tone: "bad" },
  declined: { label: "Declined", tone: "bad" },
};

export function PortalContracts() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/portal/contracts"],
    queryFn: () => portalGet("/api/portal/contracts"),
  });

  const contracts: Contract[] = (data as any)?.contracts || [];
  const library: LibraryDoc[] = (data as any)?.library || [];
  const companyName: string | null = (data as any)?.companyName || null;
  const matchedDeals = (data as any)?.matchedDeals || [];
  const source = (data as any)?.source;
  const bridgeMessage = (data as any)?.message;

  const pending = contracts.filter((c) => c.status === "pending" || c.status === "signed");
  const executed = contracts.filter((c) => c.status === "countersigned");
  const other = contracts.filter((c) => !["pending", "signed", "countersigned"].includes(c.status));

  const download = async (c: Contract) => {
    if (!c.hubSignatureId && !c.pdfUrl) return;
    setDownloadingId(c.id);
    try {
      const token = localStorage.getItem("portalToken");
      const url = c.pdfUrl || `/api/portal/contracts/${c.hubSignatureId}/download`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${c.contractNumber || c.title}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* toast optional */
    } finally {
      setDownloadingId(null);
    }
  };

  const renderContractRow = (c: Contract) => {
    const cfg = statusConfig[c.status] || statusConfig.pending;
    return (
      <li key={c.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between md:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{c.title}</p>
            <Token label={cfg.label} tone={cfg.tone} dot />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="pt-num">{c.contractNumber}</span>
            {c.documentType ? ` · ${c.documentType}` : ""}
            {c.accountName ? ` · ${c.accountName}` : ""}
          </p>
          {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
          <p className="pt-num text-xs text-muted-foreground">
            {c.createdAt ? `Created ${format(new Date(c.createdAt), "MMM d, yyyy")}` : ""}
            {c.signedAt ? ` · Signed ${format(new Date(c.signedAt), "MMM d, yyyy")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {(c.downloadAvailable || c.pdfUrl || c.hubSignatureId) && (
            <Button
              size="sm"
              variant="outline"
              className="border-border bg-card hover:bg-accent"
              disabled={downloadingId === c.id}
              onClick={() => download(c)}
              aria-label={`Download PDF for ${c.title}`}
            >
              {downloadingId === c.id ? (
                <Loader className="animate-spin" aria-hidden="true" />
              ) : (
                <Download aria-hidden="true" />
              )}
              PDF
            </Button>
          )}
        </div>
      </li>
    );
  };

  const renderGroup = (label: string, rows: Contract[]) =>
    rows.length > 0 ? (
      <li>
        <p className="border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:px-5">
          {label}
        </p>
        <ul className="divide-y divide-border">{rows.map(renderContractRow)}</ul>
      </li>
    ) : null;

  return (
    <PortalLayout title={companyName ? `${companyName} contracts` : "Contracts"} description="Company-specific agreements from TechSales (Zoho Sign and agreement packages), plus the DE document library used on the sales portal.">
      <div className="space-y-4">
        {bridgeMessage && <Callout tone="info">{bridgeMessage}</Callout>}

        {matchedDeals.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Linked TechSales deals:{" "}
            {matchedDeals.map((d: any) => `${d.accountName} (#${d.id}, ${d.stage})`).join(" · ")}
          </p>
        )}

        {isLoading && (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <p className="text-sm text-muted-foreground">Loading from TechSales…</p>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <Callout tone="bad" title="Contracts couldn't be loaded">
            Failed to load contracts. Try again or contact DE.
          </Callout>
        )}

        {!isLoading && (
          <>
            <Panel
              id="company-agreements"
              title={
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Your company agreements
                </span>
              }
              description={`${contracts.length} agreement${contracts.length === 1 ? "" : "s"}`}
              flush
            >
              {contracts.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No company-specific agreements yet"
                  description={
                    <>
                      No company-specific agreements found for this profile in TechSales yet.
                      {source === "techsales_hub" && companyName
                        ? " When a deal is linked and documents are sent for signature, they appear here."
                        : ""}
                    </>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {renderGroup("Pending", pending)}
                  {renderGroup("Executed", executed)}
                  {renderGroup("Other", other)}
                </ul>
              )}
            </Panel>

            <Panel
              id="document-library"
              title={
                <span className="flex items-center gap-2">
                  <Library className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  DE document library (TechSales)
                </span>
              }
              description="Canonical templates from the sales portal Document Library. Executed copies for your company are listed above when available."
              flush
            >
              {library.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground md:px-5">Library catalog unavailable.</p>
              ) : (
                <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                  {library.map((doc) => (
                    <li key={doc.slug} className="px-4 py-3 sm:border-b sm:border-border md:px-5">
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {doc.category} · <span className="pt-num">v{doc.version}</span> · {doc.status}
                        {doc.sendable ? " · e-signable" : ""}
                      </p>
                      {doc.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </PortalLayout>
  );
}

export default PortalContracts;
