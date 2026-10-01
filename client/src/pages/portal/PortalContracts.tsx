import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Loader,
  Info,
  Library,
} from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { format } from "date-fns";
import { PortalLayout } from "./PortalLayout";

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

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: {
    label: "Awaiting signature",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: Clock,
  },
  signed: {
    label: "Partially signed",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: CheckCircle,
  },
  countersigned: {
    label: "Fully executed",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    icon: CheckCircle,
  },
  expired: { label: "Expired", color: "text-red-700", bgColor: "bg-red-100", icon: AlertTriangle },
  declined: { label: "Declined", color: "text-red-700", bgColor: "bg-red-100", icon: XCircle },
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

  const renderContractCard = (c: Contract) => {
    const cfg = statusConfig[c.status] || statusConfig.pending;
    const Icon = cfg.icon;
    return (
      <Card key={c.id} className="border-slate-200">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold truncate">{c.title}</p>
              <Badge className={`${cfg.bgColor} ${cfg.color} border-0`}>
                <Icon className="w-3 h-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {c.contractNumber}
              {c.documentType ? ` · ${c.documentType}` : ""}
              {c.accountName ? ` · ${c.accountName}` : ""}
            </p>
            {c.description && <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>}
            <p className="text-xs text-slate-400">
              {c.createdAt ? `Created ${format(new Date(c.createdAt), "MMM d, yyyy")}` : ""}
              {c.signedAt ? ` · Signed ${format(new Date(c.signedAt), "MMM d, yyyy")}` : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {(c.downloadAvailable || c.pdfUrl || c.hubSignatureId) && (
              <Button
                size="sm"
                variant="outline"
                disabled={downloadingId === c.id}
                onClick={() => download(c)}
              >
                {downloadingId === c.id ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PortalLayout title={companyName ? `${companyName} contracts` : "Contracts"} description="Company-specific agreements from TechSales (Zoho Sign and agreement packages), plus the DE document library used on the sales portal.">
      <div className="max-w-5xl mx-auto space-y-6">
        {bridgeMessage && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{bridgeMessage}</AlertDescription>
          </Alert>
        )}

        {matchedDeals.length > 0 && (
          <p className="text-xs text-slate-500">
            Linked TechSales deals:{" "}
            {matchedDeals.map((d: any) => `${d.accountName} (#${d.id}, ${d.stage})`).join(" · ")}
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader className="w-4 h-4 animate-spin" /> Loading from TechSales…
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load contracts. Try again or contact DE.</AlertDescription>
          </Alert>
        )}

        {!isLoading && (
          <>
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Your company agreements
              </h3>
              {contracts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-slate-600 text-sm">
                    No company-specific agreements found for this profile in TechSales yet.
                    {source === "techsales_hub" && companyName
                      ? " When a deal is linked and documents are sent for signature, they appear here."
                      : ""}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {pending.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-800">Pending</p>
                      {pending.map(renderContractCard)}
                    </div>
                  )}
                  {executed.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-emerald-800">Executed</p>
                      {executed.map(renderContractCard)}
                    </div>
                  )}
                  {other.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-600">Other</p>
                      {other.map(renderContractCard)}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <CardHeader className="px-0 py-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Library className="w-4 h-4" /> DE document library (TechSales)
                </CardTitle>
                <CardDescription>
                  Canonical templates from the sales portal Document Library. Executed copies for your
                  company are listed above when available.
                </CardDescription>
              </CardHeader>
              <div className="grid sm:grid-cols-2 gap-3">
                {library.map((doc) => (
                  <Card key={doc.slug} className="border-slate-200">
                    <CardContent className="py-3">
                      <p className="font-medium text-sm">{doc.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {doc.category} · v{doc.version} · {doc.status}
                        {doc.sendable ? " · e-signable" : ""}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{doc.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {library.length === 0 && !isLoading && (
                  <p className="text-sm text-slate-500 col-span-2">Library catalog unavailable.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </PortalLayout>
  );
}

export default PortalContracts;
