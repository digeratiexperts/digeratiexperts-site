import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PortalLayout } from "./PortalLayout";
import { ArrowLeft, Printer, Download, Package, CreditCard, MapPin, HelpCircle, CheckCircle, Clock, Mail, Phone } from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import { PRIMARY_PHONE } from "@/data/companyContact";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "paid":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "processing":
      case "provisioning":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "pending":
      case "awaiting_payment":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "cancelled":
      case "refunded":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${order?.orderNumber || orderId}.html`;
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
      <PortalLayout title="Order Details">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </PortalLayout>
    );
  }

  if (isError || !order) {
    return (
      <PortalLayout title="Order Details">
        <div className="space-y-6">
          <Link href="/portal/orders">
            <Button variant="ghost" className="flex items-center gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              {error instanceof Error ? error.message : "Order not found"}
            </p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Order Details">
      <div className="space-y-6 print:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <Link href="/portal/orders">
            <Button variant="ghost" className="flex items-center gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex items-center gap-2"
              data-testid="button-print"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadReceipt}
              className="flex items-center gap-2"
              data-testid="button-download"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Order {order.orderNumber}
                    </CardTitle>
                    <CardDescription>
                      Placed on {new Date(order.createdAt).toLocaleDateString()} at{" "}
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </CardDescription>
                  </div>
                  <Badge className={`flex items-center gap-1 ${getStatusColor(order.status)}`}>
                    {order.status === "completed" ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {formatStatus(order.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-slate-700">
                          <th className="text-left font-semibold py-3">Item</th>
                          <th className="text-center font-semibold py-3">Qty</th>
                          <th className="text-right font-semibold py-3">Price</th>
                          <th className="text-right font-semibold py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.lineItems || []).map((item, index) => (
                          <tr
                            key={index}
                            className="border-b dark:border-slate-700"
                            data-testid={`line-item-${index}`}
                          >
                            <td className="py-4">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                              </div>
                            </td>
                            <td className="py-4 text-center">{item.quantity}</td>
                            <td className="py-4 text-right">
                              ${parseFloat(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-4 text-right font-medium">
                              ${parseFloat(item.total).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span>${parseFloat(order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax</span>
                      <span>${parseFloat(order.tax || "0").toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span data-testid="text-order-total">
                        ${parseFloat(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {order.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Payment Method</p>
                  <p className="font-medium" data-testid="text-payment-method">
                    {formatPaymentMethod(order.paymentMethod)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Payment Status</p>
                  <Badge className={getStatusColor(order.status)}>
                    {order.paidAt ? "Paid" : formatStatus(order.status)}
                  </Badge>
                </div>
                {order.paidAt && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Paid On</p>
                    <p className="font-medium">
                      {new Date(order.paidAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {order.zohoPaymentId && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Transaction ID</p>
                    <p className="font-mono text-xs truncate">
                      {order.zohoPaymentId}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium" data-testid="text-billing-name">
                  {order.billingName || "N/A"}
                </p>
                {order.billingCompany && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {order.billingCompany}
                  </p>
                )}
                {order.billingEmail && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {order.billingEmail}
                  </p>
                )}
                {order.billingAddress && (
                  <div className="text-gray-600 dark:text-gray-400">
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
              </CardContent>
            </Card>

            <Card className="print:hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-gray-600 dark:text-gray-400">
                  Have questions about this order? Contact our support team.
                </p>
                <div className="space-y-2">
                  <a
                    href="mailto:support@digeratiexperts.com"
                    className="flex items-center gap-2 text-[#D3126A] hover:underline"
                    data-testid="link-support-email"
                  >
                    <Mail className="h-4 w-4" />
                    support@digeratiexperts.com
                  </a>
                  <a
                    href={PRIMARY_PHONE.telHref}
                    className="flex items-center gap-2 text-[#D3126A] hover:underline"
                    data-testid="link-support-phone"
                  >
                    <Phone className="h-4 w-4" />
                    {PRIMARY_PHONE.display}
                  </a>
                </div>
                <Link href="/portal/tickets/create">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-create-ticket">
                    Create Support Ticket
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
