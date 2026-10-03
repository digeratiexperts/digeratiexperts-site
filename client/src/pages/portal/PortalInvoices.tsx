import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CreditCard, Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Callout, DataTable, EmptyState, GenericStatus, Panel, StatTile, type DataColumn } from "@/components/portal/ui";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  status: string;
  issueDate: string;
  dueDate: string;
  description?: string;
}

interface InvoicesResponse {
  invoices: Invoice[];
  zohoConnected: boolean;
  message?: string;
}

export default function PortalInvoices() {
  const { data, isLoading, isError, error } = useQuery<InvoicesResponse>({
    queryKey: ["/api/portal/invoices"],
    queryFn: () => portalGet<InvoicesResponse>("/api/portal/invoices"),
  });

  const invoices = data?.invoices || [];
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const outstandingCount = invoices.filter((i) => i.status !== "paid").length;

  const columns: DataColumn<Invoice>[] = [
    {
      key: "number",
      header: "Invoice #",
      primary: true,
      cell: (invoice) => (
        <div className="min-w-0">
          <p className="pt-num font-medium">{invoice.invoiceNumber}</p>
          {invoice.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{invoice.description}</p>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      primary: true,
      align: "right",
      className: "w-32 whitespace-nowrap",
      cell: (invoice) => <span className="pt-num font-medium">${parseFloat(invoice.amount).toFixed(2)}</span>,
    },
    {
      key: "issued",
      header: "Issue date",
      hideBelowMd: true,
      className: "w-36 whitespace-nowrap",
      cell: (invoice) => <span className="pt-num text-muted-foreground">{new Date(invoice.issueDate).toLocaleDateString()}</span>,
    },
    {
      key: "due",
      header: "Due date",
      className: "w-36 whitespace-nowrap",
      cell: (invoice) => <span className="pt-num text-muted-foreground">{new Date(invoice.dueDate).toLocaleDateString()}</span>,
    },
    {
      key: "status",
      header: "Status",
      primary: true,
      className: "w-32",
      cell: (invoice) => <GenericStatus status={invoice.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-40 whitespace-nowrap",
      cell: (invoice) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label={`View invoice ${invoice.invoiceNumber}`}
            title="View"
            data-testid={`button-view-${invoice.id}`}
          >
            <Eye aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label={`Download invoice ${invoice.invoiceNumber}`}
            title="Download"
            data-testid={`button-download-${invoice.id}`}
          >
            <Download aria-hidden="true" />
          </Button>
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button asChild variant="brand" size="sm">
              <Link href={`/portal/invoices/${invoice.id}/pay`} data-testid={`button-pay-${invoice.id}`}>
                <CreditCard aria-hidden="true" />
                Pay
              </Link>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PortalLayout title="Invoices" description="View, download and pay your invoices." width="wide">
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Invoices couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        {!data?.zohoConnected && !isLoading && (
          <Callout tone="info">
            {data?.message || "Your billing account is being set up. Invoice data may be limited."}
          </Callout>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Invoice figures">
          <StatTile label="Total invoices" value={invoices.length} hint="on file" loading={isLoading} testId="stat-total-invoices" />
          <StatTile label="Paid" value={paidCount} hint="settled" tone="ok" loading={isLoading} testId="stat-paid-invoices" />
          <StatTile
            label="Outstanding"
            value={outstandingCount}
            hint={!isLoading && outstandingCount > 0 ? "payment due" : "nothing due"}
            tone={outstandingCount > 0 ? "bad" : "neutral"}
            loading={isLoading}
            testId="stat-outstanding"
          />
        </section>

        <Panel
          id="invoice-list"
          title="Invoice list"
          description={isLoading ? "Loading…" : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
          flush
        >
          <DataTable<Invoice>
            columns={columns}
            rows={invoices}
            rowKey={(invoice) => invoice.id}
            rowTestId={(invoice) => `invoice-row-${invoice.id}`}
            loading={isLoading}
            caption="Invoices"
            empty={
              <EmptyState
                icon={FileText}
                title="No invoices found"
                description="Invoices appear here as they are issued, with a Pay link when one is due."
                action={
                  <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
                    <Link href="/portal/billing">View billing</Link>
                  </Button>
                }
              />
            }
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}
