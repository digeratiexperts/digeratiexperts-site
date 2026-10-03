import { useLocation } from "wouter";
import { CheckCircle, Phone } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, buttonPrimary, buttonSecondary } from "@/components/site/chapters";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function TicketConfirmation() {
  useSEO({
    title: "Ticket Submitted",
    description: "Your support ticket was submitted successfully.",
    noIndex: true,
  });

  const [, setLocation] = useLocation();

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Support · Confirmation"
      title="Ticket Submitted"
      subtitle="Thanks — our support team has received your request."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Ticket Submitted" }]}
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="max-w-xl">
            <div className="flex items-start gap-4 rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6">
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
              <div>
                <p className="text-lg leading-relaxed text-[#1A1228]">
                  We’ll follow up at the email you provided. For urgent production issues, call us now.
                </p>
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-2xl font-semibold text-de-magenta-paper-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                >
                  <Phone className="h-6 w-6" aria-hidden="true" />
                  {PRIMARY_PHONE.display}
                </a>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setLocation("/support/knowledge-base")} className={buttonSecondary("paper")}>
                Browse Knowledge Base
              </button>
              <button type="button" onClick={() => setLocation("/")} className={buttonPrimary("paper")}>
                Back to Home
              </button>
            </div>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
