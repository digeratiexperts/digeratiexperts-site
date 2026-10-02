import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ExternalLink, Eye, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Callout, DataTable, EmptyState, Panel, StatTile, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  totalMonthly?: number | null;
  totalOneTime?: number | null;
  createdAt: string;
  itemCount: number;
  billingName?: string;
  title?: string;
  source: string;
  detailPath?: string;
  hubStatus?: string | null;
}

interface OrdersResponse {
  orders: UnifiedOrder[];
  storeOrders?: UnifiedOrder[];
  hubOrders?: UnifiedOrder[];
  storeQuotes?: UnifiedOrder[];
  companyName?: string | null;
  sources?: { store?: string; hub?: string; storeQuotes?: string };
  message?: string;
}

function sourceLabel(source: string): string {
  switch (source) {
    case "store":
      return "Store";
    case "store_quote":
      return "Store quote";
    case "hub_deal":
      return "TechSales deal";
    case "hub_quote":
      return "TechSales quote";
    case "hub_package":
      return "TechSales package";
    default:
      return source.replace(/_/g, " ");
  }
}

function isHubSource(source: string): boolean {
  return source.startsWith("hub_");
}

const PENDING_STATUSES = ["pending", "awaiting_payment", "quote_requested", "awaiting_signature"];

/** Order vocabulary spans store and TechSales; tone carries the same meaning the old colours did. */
function orderStatusTone(status: string): TokenTone {
  switch (status) {
    case "completed":
    case "paid":
      return "ok";
    case "processing":
    case "provisioning":
    case "awaiting_signature":
      return "info";
    case "pending":
    case "awaiting_payment":
    case "quote_requested":
      return "warn";
    case "cancelled":
    case "refunded":
      return "bad";
    default:
      return "neutral";
  }
}

export default function PortalOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data, isLoading, isError, error } = useQuery<OrdersResponse>({
    queryKey: ["/api/portal/orders", statusFilter],
    queryFn: () =>
      portalGet<OrdersResponse>(
        `/api/portal/orders${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
      ),
  });

  const orders = useMemo(() => {
    const list = data?.orders || [];
    if (sourceFilter === "all") return list;
    if (sourceFilter === "store") {
      return list.filter((o) => o.source === "store" || o.source === "store_quote");
    }
    if (sourceFilter === "hub") {
      return list.filter((o) => isHubSource(o.source));
    }
    return list;
  }, [data?.orders, sourceFilter]);

  const formatStatus = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const formatMoney = (order: UnifiedOrder) => {
    const monthly = order.totalMonthly;
    const oneTime = order.totalOneTime;
    if (monthly != null && monthly > 0 && oneTime != null && oneTime > 0) {
      return `$${monthly.toFixed(0)}/mo + $${oneTime.toFixed(0)}`;
    }
    if (monthly != null && monthly > 0) return `$${monthly.toFixed(0)}/mo`;
    if (oneTime != null && oneTime > 0) return `$${oneTime.toFixed(0)}`;
    const n = parseFloat(order.total || "0");
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
  };

  const storeCount = (data?.storeOrders?.length || 0) + (data?.storeQuotes?.length || 0);
  const hubCount = data?.hubOrders?.length || 0;
  const pendingCount = orders.filter((o) => PENDING_STATUSES.includes(o.status)).length;
  const filtersActive = statusFilter !== "all" || sourceFilter !== "all";
  const orderHref = (order: UnifiedOrder) => order.detailPath || `/portal/orders/${order.id}`;

  const columns: DataColumn<UnifiedOrder>[] = [
    {
      key: "number",
      header: "Order #",
      primary: true,
      className: "whitespace-nowrap",
      cell: (order) => (
        <div className="min-w-0">
          <p className="pt-num font-medium">{order.orderNumber}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
            {order.title || order.billingName || "—"}
            {order.hubStatus ? ` · Hub: ${order.hubStatus}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      primary: true,
      className: "w-40",
      cell: (order) => <Token label={sourceLabel(order.source)} tone="neutral" className="normal-case tracking-normal" />,
    },
    {
      key: "title",
      header: "Title",
      cell: (order) => (
        <div className="max-w-[220px] min-w-0">
          <p className="truncate font-medium">{order.title || order.billingName || "—"}</p>
          {order.hubStatus && <p className="truncate text-xs text-muted-foreground">Hub: {order.hubStatus}</p>}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideBelowMd: true,
      className: "w-32 whitespace-nowrap",
      cell: (order) => <span className="pt-num text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      primary: true,
      align: "right",
      className: "w-40 whitespace-nowrap",
      cell: (order) => <span className="pt-num font-medium">{formatMoney(order)}</span>,
    },
    {
      key: "status",
      header: "Status",
      primary: true,
      className: "w-40",
      cell: (order) => <Token label={formatStatus(order.status)} tone={orderStatusTone(order.status)} dot />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      className: "w-36 whitespace-nowrap",
      cell: (order) => {
        const hub = isHubSource(order.source) || order.source === "store_quote";
        return (
          <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
            <Link href={orderHref(order)} data-testid={`button-view-order-${order.id}`}>
              {hub ? <ExternalLink aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {hub ? "Open" : "View details"}
            </Link>
          </Button>
        );
      },
    },
  ];

  const filters = (
    <>
      <Select value={sourceFilter} onValueChange={setSourceFilter}>
        <SelectTrigger className="h-9 w-[160px] border-border bg-card" aria-label="Filter orders by source" data-testid="select-source-filter">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="store">Store</SelectItem>
          <SelectItem value="hub">TechSales</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-9 w-[180px] border-border bg-card" aria-label="Filter orders by status" data-testid="select-status-filter">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="awaiting_signature">Awaiting signature</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <PortalLayout
      title="Order History"
      description={`Store purchases and TechSales deals and quotes${data?.companyName ? ` for ${data.companyName}` : ""}.`}
      width="wide"
    >
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Orders couldn't be loaded">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        {data?.sources?.hub === "unavailable" && (
          <Callout tone="warn" title="TechSales orders could not be loaded for this company">
            Bridge unavailable or company name mismatch. Store orders still appear below.
          </Callout>
        )}

        <div role="group" aria-label="Filter orders" className="flex flex-wrap items-center gap-2 sm:justify-end">
          {filters}
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Order figures">
          <StatTile label="Total" value={orders.length} hint="in this view" loading={isLoading} testId="stat-total-orders" />
          <StatTile label="Store" value={storeCount} hint="orders and quotes" loading={isLoading} testId="stat-store-orders" />
          <StatTile
            label="TechSales"
            value={hubCount}
            hint={data?.sources?.hub === "ok" ? "connected" : data?.sources?.hub === "unavailable" ? "unavailable" : "deals and quotes"}
            tone={data?.sources?.hub === "unavailable" ? "warn" : "neutral"}
            loading={isLoading}
            testId="stat-hub-orders"
          />
          <StatTile
            label="Pending"
            value={pendingCount}
            hint={!isLoading && pendingCount > 0 ? "awaiting payment or signature" : "nothing pending"}
            tone={pendingCount > 0 ? "warn" : "neutral"}
            loading={isLoading}
            testId="stat-pending-orders"
          />
        </section>

        <Panel
          id="orders-list"
          title="Orders"
          description={
            isLoading
              ? "Loading…"
              : `${orders.length} item${orders.length !== 1 ? "s" : ""}${data?.sources?.hub === "ok" ? " · TechSales connected" : ""}`
          }
          flush
        >
          <DataTable<UnifiedOrder>
            columns={columns}
            rows={orders}
            rowKey={(order) => order.id}
            rowHref={orderHref}
            rowTestId={(order) => `order-row-${order.id}`}
            loading={isLoading}
            caption="Orders"
            empty={
              <EmptyState
                icon={ShoppingCart}
                title="No orders found"
                description={
                  <>
                    {filtersActive ? "Try a different filter or " : ""}
                    <Link href="/portal/marketplace" className="pt-link hover:underline">
                      browse the client marketplace
                    </Link>
                    {" · "}
                    <Link href="/portal/contracts" className="pt-link hover:underline">
                      contracts
                    </Link>
                  </>
                }
                action={
                  filtersActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-card hover:bg-accent"
                      onClick={() => {
                        setStatusFilter("all");
                        setSourceFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button asChild variant="brand" size="sm">
                      <Link href="/portal/marketplace">Browse the marketplace</Link>
                    </Button>
                  )
                }
              />
            }
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}
