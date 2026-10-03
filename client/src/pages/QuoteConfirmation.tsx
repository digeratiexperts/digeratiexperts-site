import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle, Calendar, Mail } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { COMPANY } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

interface ConfirmationData {
  plan: string;
  reasons: string[];
  firstName: string;
  company: string;
}

export default function QuoteConfirmation() {
  useSEO({
    title: "Quote Confirmation",
    description:
      "Your IT services quote has been submitted. Review your recommended plan and schedule a consultation.",
    noIndex: true,
  });

  const [data, setData] = useState<ConfirmationData | null>(null);
  const [checked, setChecked] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const stored = sessionStorage.getItem("leadQuoteResult");
    if (stored) {
      setData(JSON.parse(stored));
    }
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <PageTemplate
        title="Quote Confirmation"
        subtitle="Loading your quote match…"
        breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
        showBackButton={false}
      >
        <p className="text-center text-white/70">Please wait.</p>
      </PageTemplate>
    );
  }

  if (!data) {
    return (
      <PageTemplate
        title="Quote match not found"
        subtitle="We couldn’t find a saved quote in this session. Run the wizard again, or book a Cyber Risk Assessment."
        breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
        showBackButton={false}
      >
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <p className="text-white/70">We couldn&apos;t find a saved quote in this session.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="brand" className="h-12" onClick={() => setLocation("/quote-wizard")}>
              Start the quote wizard
            </Button>
            <Button
              variant="outline"
              className="h-12 border-white/20 text-white hover:bg-white/10"
              onClick={() => setLocation("/")}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </PageTemplate>
    );
  }

  const mailtoHref = `mailto:${COMPANY.email}?subject=${encodeURIComponent(
    `Quote match: ${data.plan} for ${data.company}`,
  )}&body=${encodeURIComponent(
    `Hi — I just completed the quote wizard. Recommended plan: ${data.plan} for ${data.company}. Please send the details.`,
  )}`;

  return (
    <PageTemplate
      title="We've got your match"
      subtitle={`Hi ${data.firstName} — we analyzed your needs and found a fit for ${data.company}.`}
      icon={<CheckCircle className="h-8 w-8" />}
      breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
      showBackButton={false}
    >
      <div className="mx-auto max-w-2xl space-y-10">
        <section className={`p-8 ${cardClass}`}>
          <h2 className="mb-2 text-3xl font-bold text-de-accent-ink">{data.plan}</h2>
          <p className="mb-6 text-white/55">Your personalized recommendation</p>

          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/55">Why this fits you:</p>
          <div className="mb-8 space-y-4">
            {data.reasons.map((reason, idx) => (
              <div key={reason} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-de-hairline bg-de-bg text-sm font-semibold text-de-accent-ink">
                  {idx + 1}
                </span>
                <p className="leading-relaxed text-white/80">{reason}</p>
              </div>
            ))}
          </div>

          <div className={`border-t border-de-hairline p-6 ${insetClass}`}>
            <p className="mb-4 text-sm text-white/60">
              Next steps: Our team will review your profile and follow up with:
            </p>
            <ul className="space-y-2 text-white/80">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                Custom pricing for your company size
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                Implementation timeline and options
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                Answers to any questions
              </li>
            </ul>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Button asChild size="lg" variant="brand" className="h-12" data-testid="button-schedule-call">
            <a href="/book">
              <Calendar className="mr-2 h-5 w-5" aria-hidden="true" />
              {CTA.primary}
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 border-de-hairline bg-de-raised text-white hover:bg-white/10 hover:text-white"
            data-testid="button-email-details"
          >
            <a href={mailtoHref}>
              <Mail className="mr-2 h-5 w-5" aria-hidden="true" />
              Email us about this match
            </a>
          </Button>
        </div>

        <p className={`p-6 text-center text-sm text-white/60 ${insetClass}`}>
          <span className="font-semibold text-white">We respect your privacy:</span> Your information is
          secure and you&apos;ll only hear from our team about your specific plan match.{" "}
          <a href="/legal/privacy-policy" className="font-medium text-de-accent-ink underline hover:no-underline">
            View our privacy policy
          </a>
          .
        </p>

        <ConversionPathBar
          headline="Ready to talk through the match?"
          body="Book a Cyber Risk Assessment. We’ll confirm fit, pricing, and the right operating model — no hard sell."
          primaryHref="/book"
          primaryLabel={CTA.primary}
        />
      </div>
    </PageTemplate>
  );
}
