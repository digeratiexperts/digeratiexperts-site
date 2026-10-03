import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, ClosingCta, CheckList, Eyebrow, FactStrip, HeroActions } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";

export default function Guarantee() {
  useSEO({
    title: "100% Money-Back Guarantee",
    description:
      "Digerati Experts 30-day, no-questions-asked money-back guarantee on managed IT and cybersecurity services.",
    canonical: "/about/guarantee",
  });

  const em = "font-semibold text-de-magenta-paper-ink";
  const strong = "font-semibold text-[#1A1228]";

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Guarantee"
      title="100% Money-Back Guarantee"
      subtitle="No-Risk. No-Small-Print. No Questions Asked."
      breadcrumbs={[{ label: "About" }, { label: "Guarantee" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: "Client Bill of Rights", href: "/about/client-bill-of-rights" }}
          />
        </div>
      }
      heroAside={
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-[var(--de-hairline)] bg-de-raised px-8 py-10 text-center"
          data-testid="guarantee-badge"
        >
          <div className="font-heading text-7xl font-semibold leading-none tracking-[-0.03em] text-white">100%</div>
          <div className="mt-4 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-de-magenta-ink">
            Money back guarantee
          </div>
          <p className="mt-4 text-sm text-white/65">First 30 days, no questions asked.</p>
        </div>
      }
    >
      <FactStrip
        label="The guarantee at a glance"
        facts={[
          { title: "30 days", text: "Risk-free trial period" },
          { title: "100% refund", text: "Of service fees if not satisfied" },
          { title: "No penalties", text: "Release from contracts" },
        ]}
      />

      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <Eyebrow tone="paper" className="mb-4">
                In writing
              </Eyebrow>
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228]">
                The guarantee, in full
              </h2>
            </div>
            <div className="lg:col-span-8">
              <p className="max-w-[68ch] text-lg leading-relaxed text-[#3A3448]">
                Because we are ardently committed to deliver <span className={em}>excellence</span> in IT services and
                cybersecurity, keeping our commitments and <span className={em}>exceeding</span> our clients'
                expectations, we stand behind our work with a 100%, no-small-print, no weasel clause guarantee:
              </p>

              <div className="mt-8 max-w-[68ch] rounded-xl border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6 md:p-8">
                <p className="leading-relaxed text-[#1A1228]">
                  Partner with Digerati Experts as your IT and cybersecurity provider. If you are not over-the-top
                  thrilled with our support, customer service, or problem-resolution by the end of the first 30 days,
                  you can cancel your agreement and we'll refund 100% of your services fees, no questions asked. We'll
                  also release you from any contract or project you hired us to deliver without penalties.
                </p>
                <p className="mt-5 leading-relaxed text-[#3A3448]">
                  We're the <span className={strong}>only</span> IT firm in the Phoenix area that offers this bold
                  guarantee because we're confident you'll be <span className={strong}>thrilled</span> with the level
                  of support and service you receive. We also believe this guarantee keeps us{" "}
                  <span className={strong}>sharp</span> and focused on ensuring everything is done right, on time and
                  to your complete satisfaction. Why risk hiring anyone else?
                </p>
              </div>

              <div className="mt-10">
                <CheckList
                  tone="paper"
                  items={[
                    "30-day risk-free trial period",
                    "100% refund of service fees if not satisfied",
                    "Release from contracts without penalties",
                    "No questions asked, no fine print",
                  ]}
                />
              </div>
            </div>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Talk to us"
        title="Call us today to see what Elite IT & Cybersecurity is all about"
        showPhone={false}
        primary={{ label: PRIMARY_PHONE.display, href: PRIMARY_PHONE.telHref, testId: "link-phone" }}
        secondary={{ label: "Client Bill of Rights", href: "/about/client-bill-of-rights", testId: "link-bill-of-rights" }}
      />
    </PageTemplate>
  );
}
