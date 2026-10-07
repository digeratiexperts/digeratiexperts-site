import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { CreditCard, Download, HelpCircle, MapPin, Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import { AccountTeamCard } from "@/components/AccountTeamCard";
import { usePortalAccountTeam } from "@/hooks/usePortalAccountTeam";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { Callout, DataTable, EmptyState, Panel, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";
import { OrderControls } from "@/components/portal/orders/OrderControls";

interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

interface BillingAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  lineItems: LineItem[];
  subtotal: string;
  tax: string;
  total: string;
  billingName: string;
  billingEmail: string;
  billingCompany: string;
  billingAddress: BillingAddress;
  zohoPaymentId?: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderDetailResponse {
  order: OrderDetail;
}

/** Order vocabulary; tone carries the same meaning the old colours did. */
function orderStatusTone(status: string): TokenTone {
  switch (status) {
    case "completed":
      return "ok";
    case "paid":
      return "ok";
    case "processing":
    case "provisioning":
      return "info";
    case "pending":
    case "awaiting_payment":
      return "warn";
    case "cancelled":
    case "refunded":
      return "bad";
    default:
      return "neutral";
  }
}

type IndexedLine = LineItem & { index: number };

export default function PortalOrderDetail() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const { data, isLoading, isError, error } = useQuery<OrderDetailResponse>({
    queryKey: ["/api/portal/orders", orderId],
    queryFn: () => portalGet<OrderDetailResponse>(`/api/portal/orders/${orderId}`),
    enabled: !!orderId,
  });

  const order = data?.order;
  const accountTeam = usePortalAccountTeam();

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case "stripe":
        return "Credit Card";
      case "zoho":
        return "Zoho Payments";
      case "invoice":
        return "Invoice";
      case "quote_request":
        return "Quote Request";
      default:
        return method || "N/A";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadReceipt = async () => {
    try {
      const response = await fetch(`/api/portal/orders/${orderId}/receipt`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("portalToken")}`,
        },
      });
      // A 401/404/500 body must never be saved to disk as a "receipt" —
      // surface it instead (error-sweep finding, 2026-08-31).
      if (!response.ok) {
        toast({
          title: "Receipt unavailable",
          description:
            response.status === 401
              ? "Your session has expired — sign in again and retry."
              : "We couldn't generate this receipt right now. Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }
      const blob = await response.blob();
      // The server sends a PDF, or the same branded receipt as HTML while no
      // PDF renderer is installed; the saved file must carry the real type.
      const isPdf = (response.headers.get("Content-Type") || "").includes("application/pdf");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DE-receipt-${order?.orderNumber || orderId}.${isPdf ? "pdf" : "html"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download receipt:", err);
    }
  };

  if (isLoading) {
    return (
      <PortalLayout title="Order Details" backHref="/portal/orders" backLabel="Back to Orders" hideHeader>
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PortalLayout>
    );
  }

  if (isError || !order) {
    return (
      <PortalLayout title="Order Details" backHref="/portal/orders" backLabel="Back to Orders" width="narrow">
        <Callout tone="bad" title="This order isn't available">
          {error instanceof Error ? error.message : "Order not found"}
        </Callout>
      </PortalLayout>
    );
  }

  const lineItems: IndexedLine[] = (order.lineItems || []).map((item, index) => ({ ...item, index }));

  const lineColumns: DataColumn<IndexedLine>[] = [
    {
      key: "item",
      header: "Item",
      primary: true,
      cell: (item) => (
        <div className="min-w-0">
          <p className="font-medium">{item.name}</p>
          <p className="pt-num mt-0.5 text-xs text-muted-foreground">SKU: {item.sku}</p>
        </div>
      ),
    },
    { key: "qty", header: "Qty", align: "right", className: "w-20", cell: (item) => <span className="pt-num">{item.quantity}</span> },
    { key: "price", header: "Price", align: "right", hideBelowMd: true, className: "w-32 whitespace-nowrap", cell: (item) => <span className="pt-num text-muted-foreground">${parseFloat(item.unitPrice).toFixed(2)}</span> },
    { key: "total", header: "Total", primary: true, align: "right", className: "w-32 whitespace-nowrap", cell: (item) => <span className="pt-num font-medium">${parseFloat(item.total).toFixed(2)}</span> },
  ];

  return (
    <PortalLayout
      title={`Order ${order.orderNumber}`}
      eyebrow="Order details"
      description={<span className="pt-num">Placed {formatDeskTimestamp(order.createdAt)}</span>}
      backHref="/portal/orders"
      backLabel="Back to Orders"
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Token label={formatStatus(order.status)} tone={orderStatusTone(order.status)} dot />
          <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={handlePrint} data-testid="button-print">
            <Printer aria-hidden="true" />
            Print Receipt
          </Button>
          <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={handleDownloadReceipt} data-testid="button-download">
            <Download aria-hidden="true" />
            Download
          </Button>
        </div>
      }
      width="wide"
    >
      <div className="grid gap-4 print:p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Panel
            id="order-items"
            title={
              <span className="inline-flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Items
              </span>
            }
            description={`${lineItems.length} line item${lineItems.length === 1 ? "" : "s"}`}
            flush
          >
            <DataTable<IndexedLine>
              columns={lineColumns}
              rows={lineItems}
              rowKey={(item) => String(item.index)}
              rowTestId={(item) => `line-item-${item.index}`}
              caption={`Items in order ${order.orderNumber}`}
              empty={<EmptyState compact icon={Package} title="No line items" description="This order has no itemised lines." />}
            />
            <dl className="space-y-2 border-t border-border px-4 py-4 text-sm md:px-5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="pt-num">${parseFloat(order.subtotal).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="pt-num">${parseFloat(order.tax || "0").toFixed(2)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="pt-num" data-testid="text-order-total">
                  ${parseFloat(order.total).toFixed(2)}
                </dd>
              </div>
            </dl>
          </Panel>

          {order.notes && (
            <Panel id="order-notes" title="Order notes">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{order.notes}</p>
            </Panel>
          )}
        </div>

        <aside className="space-y-4">
          <div className="print:hidden">
            <OrderControls orderId={order.id} />
          </div>
          <Panel
            id="payment-info"
            title={
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Payment information
              </span>
            }
          >
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-medium" data-testid="text-payment-method">
                  {formatPaymentMethod(order.paymentMethod)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment status</dt>
                <dd className="mt-1">
                  {order.paidAt ? <Token label="Paid" tone="ok" dot /> : <Token label={formatStatus(order.status)} tone={orderStatusTone(order.status)} dot />}
                </dd>
              </div>
              {order.paidAt && (
                <div>
                  <dt className="text-muted-foreground">Paid on</dt>
                  <dd className="pt-num font-medium">{new Date(order.paidAt).toLocaleDateString()}</dd>
                </div>
              )}
              {order.zohoPaymentId && (
                <div>
                  <dt className="text-muted-foreground">Transaction ID</dt>
                  <dd className="pt-num truncate text-xs">{order.zohoPaymentId}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel
            id="billing-info"
            title={
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Billing information
              </span>
            }
          >
            <address className="space-y-1 text-sm not-italic">
              <p className="font-medium" data-testid="text-billing-name">
                {order.billingName || "N/A"}
              </p>
              {order.billingCompany && <p className="text-muted-foreground">{order.billingCompany}</p>}
              {order.billingEmail && <p className="text-muted-foreground">{order.billingEmail}</p>}
              {order.billingAddress && (
                <div className="text-muted-foreground">
                  {order.billingAddress.street && <p>{order.billingAddress.street}</p>}
                  {(order.billingAddress.city || order.billingAddress.state || order.billingAddress.zipCode) && (
                    <p>
                      {order.billingAddress.city}
                      {order.billingAddress.city && order.billingAddress.state && ", "}
                      {order.billingAddress.state} {order.billingAddress.zipCode}
                    </p>
                  )}
                  {order.billingAddress.country && <p>{order.billingAddress.country}</p>}
                </div>
              )}
            </address>
          </Panel>

          <Panel
            id="order-help"
            className="print:hidden"
            title={
              <span className="inline-flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Need help?
              </span>
            }
          >
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">Questions about this order? Your account team can help.</p>
              <AccountTeamCard team={accountTeam} stacked />
              <Button asChild variant="outline" className="w-full border-border bg-card hover:bg-accent">
                <Link href="/portal/tickets/create" data-testid="button-create-ticket">
                  Create Support Ticket
                </Link>
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </PortalLayout>
  );
}
