import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLayout } from "./PortalLayout";
import { ShoppingCart, Eye, Package, Clock, CheckCircle, ExternalLink, Store, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { portalGet } from "@/lib/portalApi";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "paid":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "processing":
      case "provisioning":
      case "awaiting_signature":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "pending":
      case "awaiting_payment":
      case "quote_requested":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "cancelled":
      case "refunded":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "paid":
      case "processing":
      case "provisioning":
      case "awaiting_signature":
        return <Package className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

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

  return (
    <PortalLayout title="Order History">
      <div className="space-y-6">
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load orders: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Order History</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Store purchases and TechSales deals/quotes
              {data?.companyName ? ` for ${data.companyName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]" aria-label="Filter orders by source" data-testid="select-source-filter">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="hub">TechSales</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Filter orders by status" data-testid="select-status-filter">
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
          </div>
        </div>

        {data?.sources?.hub === "unavailable" && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-100">
            TechSales orders could not be loaded for this company (bridge unavailable or company name
            mismatch). Store orders still appear below.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="stat-total-orders">
                {orders.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" /> Store
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="stat-store-orders">
                {storeCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> TechSales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="stat-hub-orders">
                {hubCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600" data-testid="stat-pending-orders">
                {
                  orders.filter((o) =>
                    ["pending", "awaiting_payment", "quote_requested", "awaiting_signature"].includes(
                      o.status,
                    ),
                  ).length
                }
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              {orders.length} item{orders.length !== 1 ? "s" : ""}
              {data?.sources?.hub === "ok" ? " · TechSales connected" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-gray-200 dark:bg-slate-800 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left font-semibold py-3 px-3">Order #</th>
                      <th className="text-left font-semibold py-3 px-3">Source</th>
                      <th className="text-left font-semibold py-3 px-3">Title</th>
                      <th className="text-left font-semibold py-3 px-3">Date</th>
                      <th className="text-left font-semibold py-3 px-3">Amount</th>
                      <th className="text-left font-semibold py-3 px-3">Status</th>
                      <th className="text-left font-semibold py-3 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const href = order.detailPath || `/portal/orders/${order.id}`;
                      const hub = isHubSource(order.source) || order.source === "store_quote";
                      return (
                        <tr
                          key={order.id}
                          className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                          data-testid={`order-row-${order.id}`}
                        >
                          <td className="py-4 px-3 font-medium whitespace-nowrap">
                            {order.orderNumber}
                          </td>
                          <td className="py-4 px-3">
                            <Badge variant="outline" className="font-normal">
                              {sourceLabel(order.source)}
                            </Badge>
                          </td>
                          <td className="py-4 px-3 max-w-[220px]">
                            <p className="truncate font-medium">{order.title || order.billingName || "—"}</p>
                            {order.hubStatus && (
                              <p className="text-sm text-muted-foreground truncate">
                                Hub: {order.hubStatus}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-3 whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-3 font-medium whitespace-nowrap">
                            {formatMoney(order)}
                          </td>
                          <td className="py-4 px-3">
                            <Badge
                              className={`flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}
                            >
                              {getStatusIcon(order.status)}
                              {formatStatus(order.status)}
                            </Badge>
                          </td>
                          <td className="py-4 px-3">
                            <Link href={href}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                                data-testid={`button-view-order-${order.id}`}
                              >
                                {hub ? (
                                  <ExternalLink className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                                {hub ? "Open" : "View Details"}
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">No orders found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {statusFilter !== "all" || sourceFilter !== "all" ? "Try a different filter or " : ""}
                  <Link href="/portal/marketplace" className="text-[#D3126A] hover:underline">
                    browse the client marketplace
                  </Link>
                  {" · "}
                  <Link href="/portal/contracts" className="text-[#D3126A] hover:underline">
                    contracts
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
