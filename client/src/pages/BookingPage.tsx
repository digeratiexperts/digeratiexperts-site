import { useSearch } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { Calendar, Phone, Shield, Clock, CheckCircle } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { ZohoBookingWidget } from "@/components/ZohoBookingWidget";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { IconWell } from "@/components/visual/IconWell";
import { StatementHeading } from "@/components/visual/StatementHeading";
import { CANONICAL_CSRA_ONE_TIME } from "@shared/canonicalCsra";
import { normalizeSolutionReference } from "@shared/solutionReference";

/* Campaign framing (client/src/data/campaigns.ts): the booking is a no-obligation
 * working session; the documented Cyber Security Risk Assessment is a scoped
 * product at the canonical price when it is the right next step. */
const CSRA_PRICE = `$${CANONICAL_CSRA_ONE_TIME.toLocaleString("en-US")}`;

export default function BookingPage() {
  // A buyer arriving from the Store's confirmation carries their reference (`/book?ref=DE-XXXXXX`).
  const reference = normalizeSolutionReference(new URLSearchParams(useSearch()).get("ref") ?? "");
  useSEO({
    title: "Get My Cyber Risk Assessment",
    description:
      "Book a Cyber Risk Assessment conversation with Digerati Experts. We review your Arizona environment and recommend a fit — no obligation.",
    canonical: "/book",
  });

  return (
    <PageTemplate
      title="Get Your Cyber Risk Assessment"
      subtitle="Pick a time. We look at identity, endpoints, email, backups, and operating reality before recommending a package."
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {reference ? (
            <p className="mb-4 rounded-2xl border border-de-hairline bg-de-raised px-5 py-4 text-base text-white/80" data-testid="booking-reference">
              Reference <span className="font-mono font-semibold tracking-wide text-white">{reference}</span>. Mention it when
              you book.
            </p>
          ) : null}
          <ZohoBookingWidget instanceId="page" className="overflow-hidden rounded-2xl border border-de-hairline" />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-6">
            <StatementHeading as="h2" className="mb-4 text-lg">
              What to Expect
            </StatementHeading>
            <ul className="space-y-4">
              {[
                {
                  icon: Clock,
                  title: "30-Minute Call",
                  desc: "Quick, focused discussion about your IT needs",
                },
                {
                  icon: Shield,
                  title: "Conversation First",
                  desc: "A no-obligation working session on your current security posture",
                },
                {
                  icon: CheckCircle,
                  title: "Custom Roadmap",
                  desc: "Personalized recommendations for your business",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <IconWell icon={item.icon} size="sm" surface="dark" />
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-sm font-medium text-white/70">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="de-interactive-card rounded-2xl border border-de-hairline bg-de-raised p-6">
            <StatementHeading as="h2" className="mb-3 text-lg">
              Prefer to Call
            </StatementHeading>
            <a
              href={PRIMARY_PHONE.telHref}
              className="flex min-h-11 items-center gap-3 font-semibold text-white transition-colors hover:text-de-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent"
              data-testid="link-phone-booking"
            >
              <Phone className="h-5 w-5 text-de-accent-ink" />
              <span className="text-lg">{PRIMARY_PHONE.display}</span>
            </a>
          </div>

          <div className="rounded-2xl border border-de-hairline bg-de-raised p-6">
            <div className="mb-3 flex items-center gap-3">
              <IconWell icon={Calendar} size="sm" surface="dark" />
              <StatementHeading as="h2" className="text-lg">
                No Obligation
              </StatementHeading>
            </div>
            <p className="text-sm leading-relaxed text-white/70">
              This first conversation costs nothing and commits you to nothing. When a documented
              Cyber Security Risk Assessment is the right next step, DE scopes it with you first: it is{" "}
              {CSRA_PRICE} when scoped, and nothing is billed until you say yes. You get honest
              recommendations, even if that means you don&apos;t need us.
            </p>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
