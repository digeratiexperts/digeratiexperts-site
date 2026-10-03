import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  Mail,
  Calendar,
  FileText,
  ArrowRight,
  Home,
  Loader2,
  Download,
} from "lucide-react";
import { AccountTeamCard } from "@/components/AccountTeamCard";
import { portalLoginWithReturn } from "@/lib/portalUrls";
import { warehousePath } from "@/lib/warehousePaths";

const QuoteConfirmation = () => {
  const [, params] = useRoute("/internal/warehouse/quote-confirmation/:id");
  const quoteId = params?.id;
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useSEO({
    title: "Quote Request Submitted | Digerati Experts Store",
    description: "Your quote request has been submitted successfully. Our team will contact you shortly.",
    canonical: `/internal/warehouse/quote-confirmation/${quoteId}`,
    noIndex: true,
  });

  const { data: quoteRequest, isLoading, error } = useQuery({
    queryKey: ['/api/store/quote-requests', quoteId],
    queryFn: async () => {
      // The portal session cookie is the only credential the rest of the flow
      // uses; the old localStorage bearer could only contradict a valid cookie.
      const response = await fetch(`/api/store/quote-requests/${quoteId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const failure = new Error(
          response.status === 401
            ? "Sign in to view this quote request."
            : response.status === 403
              ? "This quote request belongs to another account."
              : "Failed to fetch quote request",
        ) as Error & { status?: number };
        failure.status = response.status;
        throw failure;
      }
      return response.json();
    },
    enabled: !!quoteId,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <main className="de-nav-clear pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Loader2 className="w-12 h-12 text-de-accent-ink animate-spin mx-auto" />
            <p className="text-white/60 mt-4">Loading quote details...</p>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  if (error || !quoteRequest) {
    const status = (error as (Error & { status?: number }) | null)?.status;
    const confirmationUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${warehousePath(`/quote-confirmation/${quoteId}`)}`
        : warehousePath(`/quote-confirmation/${quoteId}`);
    const title =
      status === 401 ? "Sign in to view this quote" : status === 403 ? "Access denied" : "Quote Not Found";
    const message =
      status === 401
        ? "Your session ended before this page loaded. Sign in and you will land straight back here; the quote request itself was recorded."
        : status === 403
          ? "This quote request belongs to another account. If you submitted it, sign in with the account you used."
          : "We couldn't find the quote request you're looking for.";
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <main className="de-nav-clear pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-xl p-12"
            >
              <FileText className="w-16 h-16 text-white/55 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-4" data-testid="text-error-title">
                {title}
              </h1>
              <p className="text-white/60 mb-8" data-testid="text-error-message">
                {message}
              </p>
              {status === 401 || status === 403 ? (
                <Button asChild className="bg-de-accent hover:bg-de-accent text-white" data-testid="button-sign-in-quote">
                  <a href={portalLoginWithReturn(confirmationUrl)}>Sign in to continue</a>
                </Button>
              ) : (
                <Link href={warehousePath()}>
                  <Button className="bg-de-accent hover:bg-de-accent text-white" data-testid="button-back-to-store">
                    Back to warehouse
                  </Button>
                </Link>
              )}
            </motion.div>
          </div>
        </main>
        <DigeratiEnhancedFooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      <main className="de-nav-clear pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </motion.div>

              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid="text-confirmation-title">
                Quote Request Submitted!
              </h1>
              <p className="text-xl text-white/60" data-testid="text-confirmation-subtitle">
                Thank you for your interest. Our team will be in touch shortly.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8" data-testid="section-quote-details">
              <div className="text-center mb-8">
                <p className="text-white/60 text-sm uppercase tracking-wide mb-2">Quote Request Number</p>
                <p className="text-3xl font-mono font-bold text-de-accent-ink" data-testid="text-quote-number">
                  {quoteRequest.quoteNumber}
                </p>
                <Button
                  type="button"
                  className="mt-6 bg-[#D3126A] hover:bg-[#D3126A] text-white"
                  data-testid="button-download-quote-pdf"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setPdfError(null);
                    setIsDownloadingPdf(true);
                    try {
                      const response = await fetch(quoteRequest.pdfUrl || `/api/store/quote-requests/${quoteId}/pdf`, {
                        credentials: "include",
                      });
                      if (!response.ok) {
                        throw new Error("Unable to download the preliminary quote PDF.");
                      }
                      // The server falls back to branded HTML while no PDF
                      // renderer is installed; name the file by what came back.
                      const isPdf = (response.headers.get("Content-Type") || "").includes("application/pdf");
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${quoteRequest.quoteNumber}.${isPdf ? "pdf" : "html"}`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);
                    } catch (error: any) {
                      setPdfError(error?.message || "Unable to download the preliminary quote PDF.");
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download preliminary quote PDF
                </Button>
                {pdfError ? (
                  <p className="text-sm text-red-300 mt-3" data-testid="text-pdf-error">
                    {pdfError}
                  </p>
                ) : (
                  <p className="text-sm text-white/50 mt-3">
                    Catalog pricing for your requested solution. A consultant will confirm commercial terms.
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-de-accent-ink" />
                    <span className="text-white font-medium">Email</span>
                  </div>
                  <p className="text-white/70 ml-8" data-testid="text-contact-email">
                    {quoteRequest.contactEmail}
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-de-accent-ink" />
                    <span className="text-white font-medium">Submitted</span>
                  </div>
                  <p className="text-white/70 ml-8" data-testid="text-submitted-date">
                    {new Date(quoteRequest.createdAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {quoteRequest.companyName && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-white/60 text-sm mb-1">Company</p>
                  <p className="text-white font-medium" data-testid="text-company-name">
                    {quoteRequest.companyName}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-de-raised border border-de-hairline rounded-xl p-8 mb-8" data-testid="section-next-steps">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-de-accent-ink" />
                What Happens Next
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-de-raised rounded-full flex items-center justify-center">
                    <span className="text-de-accent-ink font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Review</h3>
                    <p className="text-white/60 text-sm">
                      Our team will review your request and requirements within 1 business day.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-de-raised rounded-full flex items-center justify-center">
                    <span className="text-de-accent-ink font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Consultation</h3>
                    <p className="text-white/60 text-sm">
                      A Digerati Experts consultant will contact you to discuss your specific needs and customize the solution.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-de-raised rounded-full flex items-center justify-center">
                    <span className="text-de-accent-ink font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Custom Quote</h3>
                    <p className="text-white/60 text-sm">
                      You'll receive a detailed quote with pricing tailored to your business requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8" data-testid="section-contact-info">
              <h3 className="text-lg font-semibold text-white mb-4">Your account team</h3>
              <AccountTeamCard team={quoteRequest?.accountTeam} tone="store" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-back-home"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/internal/warehouse">
                <Button
                  className="bg-de-accent hover:bg-de-accent text-white"
                  data-testid="button-continue-browsing"
                >
                  Continue Browsing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default QuoteConfirmation;
