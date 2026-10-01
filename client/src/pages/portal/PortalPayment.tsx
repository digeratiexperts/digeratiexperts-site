import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CreditCard, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";
import { COMPANY } from "@/data/companyContact";
import { loadCardCheckoutAvailable } from "@/lib/invoicePaymentAvailability";
import { cn } from "@/lib/utils";
import { Callout, Panel } from "@/components/portal/ui";
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

const methodClass = (selected: boolean) =>
  cn(
    "cursor-pointer rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5",
    selected ? "border-primary ring-1 ring-ring" : "border-border pt-hover-brand",
  );

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
    <PortalLayout
      title="Pay Invoice"
      description="Choose how you'd like to pay. The amount due comes from the invoice."
      backHref="/portal/invoices"
      backLabel="Back to Invoices"
      width="narrow"
    >
      <div className="space-y-4">
        {error && (
          <Callout tone="bad" title="Payment couldn't continue">
            {error}
          </Callout>
        )}

        {loadingInvoice && (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading invoice…</span>
            <Skeleton className="h-20" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}

        {!loadingInvoice && invoice && (
          <>
            <Panel id="invoice-payment" title="Invoice payment" description={<span className="pt-num">{invoiceNumber}</span>}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted-foreground">Amount due</p>
                <p className="pt-num font-heading text-2xl font-semibold leading-none">${amountDue.toFixed(2)}</p>
              </div>
            </Panel>

            <section className="space-y-3" aria-labelledby="payment-method-title">
              <h2 id="payment-method-title" className="font-heading text-[15px] font-semibold">
                Select payment method
              </h2>

              <div
                role="button"
                tabIndex={0}
                aria-pressed={selectedMethod === "card"}
                className={methodClass(selectedMethod === "card")}
                onClick={() => setSelectedMethod("card")}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setSelectedMethod("card");
                  }
                }}
                data-testid="card-payment-method"
              >
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Pay Online</p>
                    <p className="text-sm text-muted-foreground">
                      {cardCheckout
                        ? "Secure checkout via Zoho Payments"
                        : "Card checkout is not connected yet"}
                    </p>
                  </div>
                </div>
                {selectedMethod === "card" && cardCheckout && (
                  <Button
                    variant="brand"
                    className="mt-4 w-full"
                    onClick={handleZohoCheckout}
                    disabled={loading || amountDue <= 0}
                    data-testid="button-card-pay"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Processing...
                      </>
                    ) : (
                      `Pay $${amountDue.toFixed(2)}`
                    )}
                  </Button>
                )}
                {selectedMethod === "card" && !cardCheckout && (
                  <Callout tone="warn" className="mt-4">
                    Email{" "}
                    <a className="font-medium" href={`mailto:${COMPANY.billingEmail}`}>
                      {COMPANY.billingEmail}
                    </a>{" "}
                    with invoice <span className="pt-num">{invoiceNumber}</span>. This screen will not start a card payment until checkout is connected.
                  </Callout>
                )}
              </div>

              <div
                role="button"
                tabIndex={0}
                aria-pressed={selectedMethod === "zelle"}
                className={methodClass(selectedMethod === "zelle")}
                onClick={() => setSelectedMethod("zelle")}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setSelectedMethod("zelle");
                  }
                }}
                data-testid="card-zelle-method"
              >
                <div className="flex items-start gap-3">
                  <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Zelle</p>
                    <p className="text-sm text-muted-foreground">Bank transfer via Zelle</p>
                  </div>
                </div>

                {selectedMethod === "zelle" && (
                  <div className="mt-4 space-y-3 rounded-lg border border-border bg-background p-4">
                    <p className="text-sm font-medium">Scan the QR code below with your banking app:</p>
                    <div className="flex justify-center py-2">
                      <img
                        src={zelleQr}
                        alt="Zelle QR Code"
                        className="h-48 w-48 rounded-md bg-white p-2"
                        data-testid="image-zelle-qr"
                      />
                    </div>
                    <Callout tone="warn">
                      <p>
                        <strong className="text-foreground">Amount:</strong> <span className="pt-num">${amountDue.toFixed(2)}</span>
                      </p>
                      <p className="mt-1">
                        Reference: <span className="pt-num">{invoiceNumber}</span>
                      </p>
                    </Callout>
                    <Button
                      className="w-full border-border bg-card hover:bg-accent"
                      variant="outline"
                      onClick={() => navigate("/portal/invoices")}
                      data-testid="button-zelle-done"
                    >
                      Payment Sent
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {!loadingInvoice && !invoice && !error && (
          <Callout tone="warn" title="Invoice not found">
            This invoice isn't available. Go back to your invoices and try again.
          </Callout>
        )}
      </div>
    </PortalLayout>
  );
}
