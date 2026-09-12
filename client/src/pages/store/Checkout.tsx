import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSEO } from "@/hooks/useSEO";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { SolutionOrderSummary } from "@/components/store/SolutionOrderSummary";
import { snapshotSubmitLines } from "@/lib/solutionSnapshotView";
import { portalLoginWithReturn } from "@/lib/portalUrls";
import { readGuidedSession } from "@/lib/storeGuidedSession";

import {
  ArrowLeft,
  ShoppingCart,
  CreditCard,
  FileText,
  MessageSquare,
  Loader2,
  Check,
} from "lucide-react";

const billingSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  company: z.string().optional(),
  phone: z.string().optional(),
});

type BillingFormData = z.infer<typeof billingSchema>;

type PaymentMethod = "zoho" | "quote_request";

const Checkout = () => {
  const [, navigate] = useLocation();
  const { items, snapshot, clearCart } = useCart();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("zoho");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSEO({
    title: "Checkout | Digerati Experts Store",
    description: "Complete your purchase of IT services and solutions from Digerati Experts.",
    canonical: "/internal/warehouse/checkout",
    noIndex: true,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      name: "",
      email:
        readGuidedSession()?.workEmail ||
        (typeof window !== "undefined" ? window.localStorage.getItem("userEmail") || "" : ""),
      company: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (items.length === 0) {
      navigate("/internal/warehouse");
    }
  }, [items.length, navigate]);

  const onSubmit = async (data: BillingFormData) => {
    setIsSubmitting(true);
    try {
      const lineItems = snapshotSubmitLines(snapshot);

      if (paymentMethod === "zoho") {
        const response = await fetch("/api/store/checkout/zoho", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            lineItems,
            billing: data,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 401) {
            toast({
              title: "Sign in required to pay online",
              description: "Open ASK DE and sign in once, then retry checkout. Your solution is still here.",
            });
            setPaymentMethod("quote_request");
            return;
          }
          if (response.status === 403) {
            toast({
              title: "This cart needs a Client Portal role to pay online",
              description:
                "We kept your email and solution. Request a quote, or sign in as an existing co-managed client. This is not a dead 403.",
            });
            setPaymentMethod("quote_request");
            return;
          }
          if (errorData.code === "SUBSCRIPTION_BILLING_REQUIRED" && errorData.quoteRequired) {
            toast({
              title: "Recurring services move through subscription setup",
              description:
                "Your solution is intact. We switched checkout to Request Quote so recurring billing can be provisioned correctly instead of charging it as a one-time purchase.",
            });
            setPaymentMethod("quote_request");
            return;
          }
          if (errorData.code === "DURABLE_DATABASE_REQUIRED") {
            toast({
              title: "Online payment is temporarily unavailable",
              description:
                "We will not accept payment without durable order storage. Your solution is intact, and you can request a quote instead.",
            });
            setPaymentMethod("quote_request");
            return;
          }
          throw new Error(errorData.error || "Failed to create checkout session");
        }

        const result = await response.json();
        if (result.url) {
          window.location.href = result.url;
        } else if (result.orderId) {
          clearCart();
          const ct = result.confirmationToken
            ? `&ct=${encodeURIComponent(result.confirmationToken)}`
            : "";
          navigate(`/internal/warehouse/order-confirmation?orderId=${result.orderId}${ct}`);
        }
      } else if (paymentMethod === "quote_request") {
        navigate("/internal/warehouse/quote-request");
        return;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout Failed",
        description: error.message || "Unable to process your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />

      <main className="de-nav-clear pb-[calc(5rem+var(--de-cookie-h)+var(--de-sticky-cta-h)+var(--de-unified-bar-h))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid lg:grid-cols-5 gap-8 lg:items-start"
          >
            <div className="order-2 lg:order-1 lg:col-span-3 space-y-8">
          <nav className="mb-2" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-white/50">
              <li>
                <Link href="/internal/warehouse" className="hover:text-white transition-colors" data-testid="breadcrumb-store">
                  Store
                </Link>
              </li>
              <li>/</li>
              <li className="text-white" data-testid="breadcrumb-checkout">Checkout</li>
            </ol>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/internal/warehouse">
              <Button variant="ghost" className="text-white/60 hover:text-white" data-testid="button-back-to-store">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Store
              </Button>
            </Link>
          </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-checkout-title">
              Checkout
            </h1>
            <p className="text-white/60" data-testid="text-checkout-subtitle">
              Complete your order for IT services and solutions
            </p>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6" data-testid="section-billing-info">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-de-accent-ink" />
                    Billing Information
                  </h2>

                  <form id="checkout-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-white/80">
                          Full Name *
                        </Label>
                        <Input
                          id="name"
                          {...register("name")}
                          required
                          aria-required={true}
                          placeholder="John Smith"
                          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-de-muted-soft focus:border-de-hairline"
                          data-testid="input-name"
                        />
                        {errors.name && (
                          <p className="text-red-400 text-sm mt-1" data-testid="error-name">
                            {errors.name.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-white/80">
                          Email Address *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          {...register("email")}
                          required
                          aria-required={true}
                          placeholder="john@company.com"
                          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-de-muted-soft focus:border-de-hairline"
                          data-testid="input-email"
                        />
                        {errors.email && (
                          <p className="text-red-400 text-sm mt-1" data-testid="error-email">
                            {errors.email.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company" className="text-white/80">
                          Company Name
                        </Label>
                        <Input
                          id="company"
                          {...register("company")}
                          placeholder="Acme Corp"
                          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/55 focus:border-de-hairline"
                          data-testid="input-company"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-white/80">
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          {...register("phone")}
                          placeholder="(555) 123-4567"
                          className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/55 focus:border-de-hairline"
                          data-testid="input-phone"
                        />
                      </div>
                    </div>
                  </form>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6" data-testid="section-payment-method">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-de-accent-ink" />
                    Payment Method
                  </h2>

                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="payment-zoho"
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "zoho"
                          ? "border-de-hairline bg-de-raised"
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      <RadioGroupItem value="zoho" id="payment-zoho" data-testid="radio-zoho" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-de-accent-ink" />
                          <span className="font-medium text-white">Credit / Debit Card</span>
                        </div>
                        <p className="text-sm text-white/60 mt-1">
                          Secure payment processing. All major cards accepted.
                        </p>
                      </div>
                      {paymentMethod === "zoho" && (
                        <Check className="w-5 h-5 text-de-accent-ink" />
                      )}
                    </label>

                    <label
                      htmlFor="payment-quote"
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "quote_request"
                          ? "border-de-hairline bg-de-raised"
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      <RadioGroupItem value="quote_request" id="payment-quote" data-testid="radio-quote" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-emerald-400" />
                          <span className="font-medium text-white">Request Quote</span>
                        </div>
                        <p className="text-sm text-white/60 mt-1">
                          Get a custom quote from our team. We'll contact you within 1 business day.
                        </p>
                      </div>
                      {paymentMethod === "quote_request" && (
                        <Check className="w-5 h-5 text-de-accent-ink" />
                      )}
                    </label>
                  </RadioGroup>
                  <p className="mt-4 text-sm text-white/45">
                    Already a co-managed client?{" "}
                    <a
                      href={portalLoginWithReturn(
                        typeof window !== "undefined"
                          ? `${window.location.origin}/store/checkout`
                          : "/internal/warehouse/checkout",
                      )}
                      className="text-de-accent-ink underline-offset-4 hover:underline"
                      data-testid="checkout-portal-login"
                    >
                      Open Client Portal login
                    </a>
                    . Prospects should use Request Quote — card checkout still requires an existing store role.
                  </p>
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:col-span-2">
                <SolutionOrderSummary
                  snapshot={snapshot}
                  title="Order Summary"
                  titleIcon={<ShoppingCart className="h-5 w-5 text-de-accent-ink" />}
                  footer={
                    <>
                      <Button
                        type="submit"
                        form="checkout-form"
                        disabled={isSubmitting}
                        className="mt-6 w-full bg-de-accent py-6 text-lg font-semibold text-white hover:bg-de-accent"
                        data-testid="button-submit-order"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : paymentMethod === "quote_request" ? (
                          <>
                            <MessageSquare className="mr-2 h-5 w-5" />
                            Request Quote
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-5 w-5" />
                            Pay Now
                          </>
                        )}
                      </Button>
                      <p className="mt-4 text-center text-xs text-white/55">
                        By completing this order, you agree to our{" "}
                        <Link href="/legal/terms-of-use" className="text-de-accent-ink hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/legal/privacy-policy" className="text-de-accent-ink hover:underline">
                          Privacy Policy
                        </Link>
                      </p>
                    </>
                  }
                />
              </div>
          </motion.div>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default Checkout;
