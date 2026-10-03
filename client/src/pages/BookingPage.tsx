import { useSearch } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { Phone } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { ZohoBookingWidget } from "@/components/ZohoBookingWidget";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { Chapter, Container, Eyebrow, HeroActions } from "@/components/site/chapters";
import { CANONICAL_CSRA_ONE_TIME } from "@shared/canonicalCsra";
import { normalizeSolutionReference } from "@shared/solutionReference";
import { SituationContinuityStrip } from "@/components/SituationContinuityStrip";
import { useAnonymousSituation } from "@/lib/anonymousSituation";

/* Campaign framing (client/src/data/campaigns.ts): the booking is a no-obligation
 * working session; the documented Cyber Security Risk Assessment is a scoped
 * product at the canonical price when it is the right next step. */
const CSRA_PRICE = `$${CANONICAL_CSRA_ONE_TIME.toLocaleString("en-US")}`;

const expectations = [
  { title: "30-Minute Call", text: "Quick, focused discussion about your IT needs" },
  { title: "Conversation First", text: "A no-obligation working session on your current security posture" },
  { title: "Custom Roadmap", text: "Personalized recommendations for your business" },
];

export default function BookingPage() {
  // A buyer arriving from the Store's confirmation carries their reference (`/book?ref=DE-XXXXXX`).
  const reference = normalizeSolutionReference(new URLSearchParams(useSearch()).get("ref") ?? "");
  const situation = useAnonymousSituation();
  useSEO({
    title: "Get My Cyber Risk Assessment",
    description:
      "Book a Cyber Risk Assessment conversation with Digerati Experts. We review your Arizona environment and recommend a fit — no obligation.",
    canonical: "/book",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Book · Cyber Risk Assessment"
      title="Get Your Cyber Risk Assessment"
      subtitle="Pick a time. We look at identity, endpoints, email, backups, and operating reality before recommending a package."
      showBackButton={false}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Choose a time", href: "#schedule" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false} id="schedule" className="scroll-mt-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-8">
              {situation ? (
                <SituationContinuityStrip situation={situation} door="booking" tone="paper" className="mb-4" />
              ) : null}
              {reference ? (
                <p
                  className="mb-4 rounded-xl border border-[var(--de-paper-hairline)] bg-white px-5 py-4 text-base text-[#3A3448]"
                  data-testid="booking-reference"
                >
                  Reference <span className="font-mono font-semibold tracking-wide text-[#1A1228]">{reference}</span>. Mention it when
                  you book.
                </p>
              ) : null}
              <ZohoBookingWidget
                instanceId="page"
                className="overflow-hidden rounded-xl border border-[var(--de-paper-hairline)] bg-white"
              />
            </div>

            <aside className="space-y-10 lg:col-span-4">
              <section>
                <Eyebrow tone="paper" className="mb-3">
                  The call
                </Eyebrow>
                <h2 className="font-heading text-xl font-semibold text-[#1A1228]">What to Expect</h2>
                <ol className="mt-4 border-t border-[var(--de-paper-hairline)]">
                  {expectations.map((item, i) => (
                    <li key={item.title} className="border-b border-[var(--de-paper-hairline)] py-4">
                      <span className="font-mono text-xs font-semibold tracking-[0.16em] text-de-magenta-paper-ink">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-1 font-heading text-base font-semibold text-[#1A1228]">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#3A3448]">{item.text}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="border-t border-[var(--de-paper-hairline)] pt-8">
                <h2 className="font-heading text-xl font-semibold text-[#1A1228]">Prefer to Call</h2>
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="mt-2 flex min-h-11 items-center gap-3 font-semibold text-[#1A1228] transition-colors hover:text-de-magenta-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                  data-testid="link-phone-booking"
                >
                  <Phone className="h-5 w-5 text-de-magenta-paper-ink" aria-hidden="true" />
                  <span className="text-lg">{PRIMARY_PHONE.display}</span>
                </a>
              </section>

              <section className="border-t border-[var(--de-paper-hairline)] pt-8">
                <h2 className="font-heading text-xl font-semibold text-[#1A1228]">No Obligation</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#3A3448]">
                  This first conversation costs nothing and commits you to nothing. When a documented
                  Cyber Security Risk Assessment is the right next step, DE scopes it with you first: it is{" "}
                  {CSRA_PRICE} when scoped, and nothing is billed until you say yes. You get honest
                  recommendations, even if that means you don&apos;t need us.
                </p>
              </section>
            </aside>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
