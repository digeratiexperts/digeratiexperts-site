import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import {
  ArrowLeft,
  AlertCircle,
  CreditCard,
  QrCode,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { portalGet, portalPost } from "@/lib/portalApi";
import { COMPANY } from "@/data/companyContact";
import { loadCardCheckoutAvailable } from "@/lib/invoicePaymentAvailability";
import zelleQr from "@assets/qrCode_1763920410167.png";

interface PaymentProps {
  invoiceId: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  amount: string;
  balance?: number;
  status: string;
  currency?: string;
}

export default function PortalPayment({ invoiceId }: PaymentProps) {
  const [, navigate] = useLocation();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"card" | "zelle" | null>(null);
  const [cardCheckout, setCardCheckout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCardCheckoutAvailable().then((available) => {
      if (!cancelled) setCardCheckout(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInvoice(true);
      setError("");
      try {
        const data = await portalGet<InvoiceDetail>(`/api/portal/invoices/${invoiceId}`);
        if (!cancelled) setInvoice(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load invoice");
          setInvoice(null);
        }
      } finally {
        if (!cancelled) setLoadingInvoice(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const amountDue = invoice
    ? Number(invoice.balance ?? invoice.amount)
    : 0;
  const invoiceNumber = invoice?.invoiceNumber || invoiceId;

  const handleZohoCheckout = async () => {
    if (!invoice) return;
    setLoading(true);
    setError("");

    try {
      const data = await portalPost<{ url?: string }>("/api/portal/payment/zoho", {
        invoiceId: invoice.id,
        amount: Math.round(amountDue * 100),
      });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Payment session did not return a checkout URL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalLayout title="Pay Invoice">
      <div className="space-y-6 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/portal/invoices")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Button>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {loadingInvoice && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading invoice…
          </div>
        )}

        {!loadingInvoice && invoice && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoice Payment</CardTitle>
                    <CardDescription>{invoiceNumber}</CardDescription>
                  </div>
                  <Badge className="bg-[#D3126A] hover:bg-[#D3126A]/90 text-white text-lg px-3 py-1">
                    ${amountDue.toFixed(2)}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Select Payment Method</h3>

              <Card
                className={`cursor-pointer transition-all ${
                  selectedMethod === "card"
                    ? "ring-2 ring-[#D3126A] border-[#D3126A]"
                    : "hover:border-[#D3126A]/50"
                }`}
                onClick={() => setSelectedMethod("card")}
                data-testid="card-payment-method"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Pay Online</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {cardCheckout
                          ? "Secure checkout via Zoho Payments"
                          : "Card checkout is not connected yet"}
                      </p>
                    </div>
                  </div>
                  {selectedMethod === "card" && cardCheckout && (
                    <Button
                      className="mt-4 w-full bg-[#D3126A] hover:bg-[#D3126A]/90 text-white"
                      onClick={handleZohoCheckout}
                      disabled={loading || amountDue <= 0}
                      data-testid="button-card-pay"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Pay $${amountDue.toFixed(2)}`
                      )}
                    </Button>
                  )}
                  {selectedMethod === "card" && !cardCheckout && (
                    <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                      Email{" "}
                      <a className="font-medium underline" href={`mailto:${COMPANY.billingEmail}`}>
                        {COMPANY.billingEmail}
                      </a>{" "}
                      with invoice {invoiceNumber}. This screen will not start a card payment until checkout is connected.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  selectedMethod === "zelle"
                    ? "ring-2 ring-[#D3126A] border-[#D3126A]"
                    : "hover:border-[#D3126A]/50"
                }`}
                onClick={() => setSelectedMethod("zelle")}
                data-testid="card-zelle-method"
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <QrCode className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">Zelle</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Bank transfer via Zelle
                        </p>
                      </div>
                    </div>

                    {selectedMethod === "zelle" && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-3">
                        <p className="text-sm font-medium">
                          Scan the QR code below with your banking app:
                        </p>
                        <div className="flex justify-center py-2">
                          <img
                            src={zelleQr}
                            alt="Zelle QR Code"
                            className="h-48 w-48"
                            data-testid="image-zelle-qr"
                          />
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded text-sm">
                          <p className="text-yellow-800 dark:text-yellow-300">
                            <strong>Amount:</strong> ${amountDue.toFixed(2)}
                          </p>
                          <p className="text-yellow-800 dark:text-yellow-300 mt-1">
                            Reference: {invoiceNumber}
                          </p>
                        </div>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => navigate("/portal/invoices")}
                          data-testid="button-zelle-done"
                        >
                          Payment Sent
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!loadingInvoice && !invoice && !error && (
          <p className="text-gray-600 dark:text-gray-400">Invoice not found.</p>
        )}
      </div>
    </PortalLayout>
  );
}
