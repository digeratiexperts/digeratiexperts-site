import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useSEO } from "@/hooks/useSEO";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { SolutionOrderSummary } from "@/components/store/SolutionOrderSummary";
import { snapshotSubmitLines } from "@/lib/solutionSnapshotView";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Loader2,
  Package,
  CheckCircle,
} from "lucide-react";

const quoteRequestSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().optional(),
});

type QuoteRequestFormData = z.infer<typeof quoteRequestSchema>;

const QuoteRequest = () => {
  const [, navigate] = useLocation();
  const { items, snapshot, clearCart } = useCart();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSEO({
    title: "Request a Quote | Digerati Experts Store",
    description: "Request a custom quote for IT services and solutions from Digerati Experts.",
    canonical: "/internal/warehouse/quote-request",
    noIndex: true,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuoteRequestFormData>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      message: "",
    },
  });

  const onSubmit = async (data: QuoteRequestFormData) => {
    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add items to your solution before requesting a quote.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const requestedItems = snapshotSubmitLines(snapshot);

      const response = await fetch("/api/store/quote-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          contactName: data.name,
          contactEmail: data.email,
          contactPhone: data.phone || null,
          companyName: data.company || null,
          message: data.message || null,
          requestedItems,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Sign in required",
            description: "Open ASK DE and sign in once, then submit your quote again.",
            variant: "destructive",
          });
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create quote request");
      }

      const result = await response.json();
      clearCart();
      navigate(`/internal/warehouse/quote-confirmation/${result.id}`);
    } catch (error: any) {
      console.error("Quote request error:", error);
      toast({
        title: "Request Failed",
        description: error.message || "Unable to submit your quote request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <MegaMenu />
        <main className="de-nav-clear pb-[calc(5rem+var(--de-cookie-h)+var(--de-sticky-cta-h)+var(--de-unified-bar-h))]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white/5 border border-white/10 rounded-xl p-12"
            >
              <Package className="w-16 h-16 text-white/55 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-4" data-testid="text-empty-cart-title">
                No Items to Quote
              </h1>
              <p className="text-white/60 mb-8" data-testid="text-empty-cart-message">
                Add items to your solution before requesting a quote.
              </p>
              <Link href="/internal/warehouse">
                <Button className="bg-de-accent hover:bg-de-accent text-white" data-testid="button-browse-store">
                  Browse Store
                </Button>
              </Link>
            </motion.div>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <MegaMenu />

      <main className="de-nav-clear pb-[calc(5rem+var(--de-cookie-h)+var(--de-sticky-cta-h)+var(--de-unified-bar-h))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-white/50">
              <li>
                <Link href="/internal/warehouse" className="hover:text-white transition-colors" data-testid="breadcrumb-store">
                  Store
                </Link>
              </li>
              <li>/</li>
              <li className="text-white" data-testid="breadcrumb-quote-request">Request Quote</li>
            </ol>
          </nav>

          <div className="flex items-center gap-4 mb-8">
            <Link href="/internal/warehouse/checkout">
              <Button variant="ghost" className="text-white/60 hover:text-white" data-testid="button-back-to-checkout">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Checkout
              </Button>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-quote-request-title">
              Request a Quote
            </h1>
            <p className="text-white/60 mb-8" data-testid="text-quote-request-subtitle">
              Get a custom quote from our team. We'll contact you within 1 business day.
            </p>

            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6" data-testid="section-contact-info">
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-de-accent-ink" />
                    Contact Information
                  </h2>

                  <form id="quote-request-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-white/80">
                        Additional Details
                      </Label>
                      <Textarea
                        id="message"
                        {...register("message")}
                        placeholder="Tell us about your specific requirements or questions..."
                        rows={4}
                        className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-white/55 focus:border-de-hairline resize-none"
                        data-testid="input-message"
                      />
                    </div>
                  </form>
                </div>

                <div className="bg-de-raised border border-de-hairline rounded-xl p-6" data-testid="section-quote-info">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-de-accent-ink" />
                    What to Expect
                  </h3>
                  <ul className="space-y-2 text-white/70 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-de-accent-ink">•</span>
                      A Digerati Experts consultant will review your request
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-de-accent-ink">•</span>
                      You'll receive a detailed quote within 1 business day
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-de-accent-ink">•</span>
                      Custom pricing based on your specific needs
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-de-accent-ink">•</span>
                      No obligation - review the quote at your convenience
                    </li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-2">
                <SolutionOrderSummary
                  snapshot={snapshot}
                  title="Items to Quote"
                  titleIcon={<MessageSquare className="h-5 w-5 text-de-accent-ink" />}
                  testId="section-items-summary"
                  footer={
                    <>
                      <p className="mt-3 text-xs text-white/50">
                        Final pricing may vary based on your specific requirements
                      </p>
                      <Button
                        type="submit"
                        form="quote-request-form"
                        disabled={isSubmitting}
                        className="mt-6 w-full bg-de-accent py-6 text-lg font-semibold text-white hover:bg-de-accent"
                        data-testid="button-submit-quote"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="mr-2 h-5 w-5" />
                            Submit Quote Request
                          </>
                        )}
                      </Button>
                    </>
                  }
                />
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default QuoteRequest;
