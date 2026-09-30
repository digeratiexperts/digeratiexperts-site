import { useEffect, useMemo } from "react";
import { useSearch, Link } from "wouter";
import { parseOrderConfirmationParams } from "./orderConfirmationParams";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { useCart } from "@/contexts/CartContext";
const formatCurrency = (amount: number): string => {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
import {
  CheckCircle,
  Package,
  Mail,
  ArrowRight,
  ShoppingBag,
  FileText,
  Clock,
  Phone,
  MessageSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

interface OrderLineItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  pricingType: string;
  total: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  lineItems: OrderLineItem[];
  subtotal: string;
  tax: string;
  total: string;
  billingEmail: string;
  billingName: string;
  billingCompany: string | null;
  createdAt: string;
  paidAt: string | null;
}

const OrderConfirmation = () => {
  const search = useSearch();
  const { clearCart } = useCart();

  const params = useMemo(() => parseOrderConfirmationParams(search), [search]);

  useSEO({
    title: "Order Confirmation | Digerati Experts Store",
    description: "Your order has been received. Thank you for your purchase.",
    canonical: "/internal/warehouse/order-confirmation",
    noIndex: true,
  });

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: ["/api/store/orders", params.orderId, params.confirmationToken],
    enabled: !!params.orderId,
    queryFn: async () => {
      const token = localStorage.getItem("portalToken");
      const ctQuery = params.confirmationToken
        ? `?ct=${encodeURIComponent(params.confirmationToken)}`
        : "";
      const response = await fetch(`/api/store/orders/${params.orderId}${ctQuery}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text || "Failed to load order"}`);
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (order) {
      clearCart();
    }
  }, [order, clearCart]);

  const isQuoteRequest = params.method === "quote" || order?.paymentMethod === "quote_request";

  const statusConfig = {
    pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-400/10" },
    quote_requested: { label: "Quote Requested", color: "text-blue-400", bg: "bg-blue-400/10" },
    paid: { label: "Paid", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    processing: { label: "Processing", color: "text-de-accent-ink", bg: "bg-de-raised" },
    completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  };

  const status = statusConfig[order?.status as keyof typeof statusConfig] || statusConfig.pending;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <MegaMenu />
        <main className="de-nav-clear pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-12 h-12 text-de-accent-ink animate-spin mb-4" />
            <p className="text-white/60">Loading order details...</p>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  if (error || (!order && !isLoading)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <MegaMenu />
        <main className="de-nav-clear pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-4">Order Not Found</h1>
            <p className="text-white/60 mb-8">
              We couldn't find your order. Please check your email for confirmation or contact support.
            </p>
            <Link href="/internal/warehouse">
              <Button className="bg-de-accent hover:bg-de-accent text-white" data-testid="button-back-to-store">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  const lineItems: OrderLineItem[] = Array.isArray(order?.lineItems) 
    ? order.lineItems 
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />

      <main className="de-nav-clear pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-de-raised mb-6">
              <CheckCircle className="w-10 h-10 text-de-accent-ink" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid="text-confirmation-title">
              {isQuoteRequest ? "Quote Request Received!" : "Order Confirmed!"}
            </h1>
            <p className="text-lg text-white/60 max-w-lg mx-auto" data-testid="text-confirmation-subtitle">
              {isQuoteRequest
                ? "We've received your quote request. Our team will reach out within 1 business day."
                : "Thank you for your purchase. You'll receive a confirmation email shortly."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 mb-8"
            data-testid="section-order-details"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-white/10">
              <div>
                <p className="text-white/60 text-sm mb-1">Order Number</p>
                <p className="text-2xl font-bold text-white font-mono" data-testid="text-order-number">
                  {order?.orderNumber || "Processing..."}
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${status.bg}`}>
                <div className={`w-2 h-2 rounded-full ${status.color} bg-current`} />
                <span className={`font-medium ${status.color}`} data-testid="text-order-status">
                  {status.label}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-white/60 text-sm mb-2">Billing Details</p>
                <p className="text-white font-medium" data-testid="text-billing-name">
                  {order?.billingName}
                </p>
                {order?.billingCompany && (
                  <p className="text-white/80" data-testid="text-billing-company">
                    {order.billingCompany}
                  </p>
                )}
                <p className="text-white/60" data-testid="text-billing-email">
                  {order?.billingEmail}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-2">Order Date</p>
                <p className="text-white" data-testid="text-order-date">
                  {order?.createdAt
                    ? new Date(order.createdAt).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Just now"}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-white/60 text-sm mb-4">Items Ordered</p>
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-3 border-b border-white/10 last:border-0"
                    data-testid={`order-item-${item.productId}`}
                  >
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-white/50 text-sm">
                        Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-white font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/20 pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-white/60">Subtotal</span>
                <span className="text-white">{formatCurrency(parseFloat(order?.subtotal || "0"))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Tax</span>
                <span className="text-white">{formatCurrency(parseFloat(order?.tax || "0"))}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-white/10">
                <span className="text-white">Total</span>
                <span className="text-de-accent-ink" data-testid="text-order-total">
                  {formatCurrency(parseFloat(order?.total || "0"))}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-de-raised border border-de-hairline rounded-xl p-6 md:p-8 mb-8"
            data-testid="section-next-steps"
          >
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-de-accent-ink" />
              What's Next?
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-de-raised flex items-center justify-center">
                  <Mail className="w-5 h-5 text-de-accent-ink" />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Confirmation Email</p>
                  <p className="text-white/60 text-sm">
                    {isQuoteRequest
                      ? "You'll receive an email confirming your quote request."
                      : "Check your inbox for order details and receipt."}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-de-raised flex items-center justify-center">
                  <Clock className="w-5 h-5 text-de-accent-ink" />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">
                    {isQuoteRequest ? "Team Contact" : "Provisioning"}
                  </p>
                  <p className="text-white/60 text-sm">
                    {isQuoteRequest
                      ? "Our team will reach out within 1 business day."
                      : "We'll begin setting up your services right away."}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-de-raised flex items-center justify-center">
                  <Package className="w-5 h-5 text-de-accent-ink" />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Get Started</p>
                  <p className="text-white/60 text-sm">
                    {isQuoteRequest
                      ? "Once approved, we'll guide you through onboarding."
                      : "Access your services from the client portal."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/internal/warehouse">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                data-testid="button-continue-shopping"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>

            <Link href="/portal/dashboard">
              <Button
                className="bg-de-accent hover:bg-de-accent text-white"
                data-testid="button-go-to-portal"
              >
                Go to Client Portal
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <p className="text-white/60 mb-4">Need help with your order?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={PRIMARY_PHONE.telHref}
                className="inline-flex items-center gap-2 text-de-accent-ink hover:text-de-accent-ink transition-colors"
                data-testid="link-phone-support"
              >
                <Phone className="w-4 h-4" />
                {PRIMARY_PHONE.display}
              </a>
              <Link href="/support/submit-ticket">
                <span className="inline-flex items-center gap-2 text-de-accent-ink hover:text-de-accent-ink transition-colors cursor-pointer" data-testid="link-submit-ticket">
                  <MessageSquare className="w-4 h-4" />
                  Submit a Ticket
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default OrderConfirmation;
