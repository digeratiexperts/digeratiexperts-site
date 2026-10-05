import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Calendar, Mail } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ClosingCta,
  CheckList,
  buttonPrimary,
  buttonSecondary,
  Eyebrow,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { COMPANY } from "@/data/companyContact";

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
        layout="chapters"
        eyebrow="Quote"
        title="Quote Confirmation"
        subtitle="Loading your quote match…"
        breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
        showBackButton={false}
      >
        <Chapter tone="paper" seam={false}>
          <Container>
            <p className="text-[#3A3448]">Please wait.</p>
          </Container>
        </Chapter>
      </PageTemplate>
    );
  }

  if (!data) {
    return (
      <PageTemplate
        layout="chapters"
        eyebrow="Quote"
        title="Quote match not found"
        subtitle="We couldn’t find a saved quote in this session. Run the wizard again, or book a Cyber Risk Assessment."
        breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
        showBackButton={false}
      >
        <Chapter tone="paper" seam={false}>
          <Container>
            <div className="max-w-xl">
              <p className="text-lg text-[#3A3448]">We couldn&apos;t find a saved quote in this session.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" className={buttonPrimary("paper")} onClick={() => setLocation("/quote-wizard")}>
                  Start the quote wizard
                </button>
                <button type="button" className={buttonSecondary("paper")} onClick={() => setLocation("/")}>
                  Back to Home
                </button>
              </div>
            </div>
          </Container>
        </Chapter>
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
      layout="chapters"
      eyebrow="Quote match"
      title="We've got your match"
      subtitle={`Hi ${data.firstName} — we analyzed your needs and found a fit for ${data.company}.`}
      breadcrumbs={[{ label: "Quote", href: "/quote-wizard" }, { label: "Confirmation" }]}
      showBackButton={false}
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <section className="lg:col-span-7">
              <Eyebrow tone="paper" className="mb-4">
                Your personalized recommendation
              </Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-de-magenta-paper-ink md:text-4xl">
                {data.plan}
              </h2>
              <p className="mb-4 mt-8 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                Why this fits you:
              </p>
              <ol className="border-t border-[var(--de-paper-hairline)]">
                {data.reasons.map((reason, idx) => (
                  <li key={reason} className="flex items-start gap-4 border-b border-[var(--de-paper-hairline)] py-4">
                    <span className="font-mono text-sm font-semibold text-de-magenta-paper-ink">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <p className="leading-relaxed text-[#1A1228]">{reason}</p>
                  </li>
                ))}
              </ol>
            </section>

            <aside className="space-y-8 lg:col-span-5">
              <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6">
                <p className="mb-4 text-sm text-[#3A3448]">
                  Next steps: Our team will review your answers and reach out within one business day with:
                </p>
                <CheckList
                  tone="paper"
                  columns={1}
                  items={[
                    "Custom pricing for your company size",
                    "Implementation timeline and options",
                    "Answers to any questions",
                  ]}
                />
              </div>

              <div className="flex flex-col gap-3">
                <a href="/book" className={buttonPrimary("paper")} data-testid="button-schedule-call">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                  {CTA.primary}
                </a>
                <a href={mailtoHref} className={buttonSecondary("paper")} data-testid="button-email-details">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                  Email us about this match
                </a>
              </div>

              <p className="text-sm leading-relaxed text-[#3A3448]">
                <span className="font-semibold text-[#1A1228]">We respect your privacy:</span> Your information is
                secure and you&apos;ll only hear from our team about your specific plan match.{" "}
                <a href="/legal/privacy-policy" className="font-medium text-de-magenta-paper-ink underline hover:no-underline">
                  View our privacy policy
                </a>
                .
              </p>
            </aside>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        title="Ready to talk through the match?"
        lede="Book a Cyber Risk Assessment. We’ll confirm fit, pricing, and the right operating model — no hard sell."
        primary={{ label: CTA.primary, href: "/book" }}
      />
    </PageTemplate>
  );
}
