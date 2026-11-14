import { Link } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, ClosingCta, Eyebrow, FactStrip, HeroActions } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE, PUBLIC_PHONE_CTA } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";
import {
  GUARANTEE_AGREEMENT_CONTROLS_AFTER,
  GUARANTEE_AGREEMENT_CONTROLS_BEFORE,
  GUARANTEE_HOW_IT_WORKS,
  GUARANTEE_MSA_HREF,
  GUARANTEE_MSA_LINK_TEXT,
  GUARANTEE_INTRO,
  GUARANTEE_SHORT,
  GUARANTEE_TITLE,
  GUARANTEE_WHATS_COVERED,
  GUARANTEE_WHATS_NOT_COVERED,
} from "@shared/publicGuarantee";

export default function Guarantee() {
  useSEO({
    title: GUARANTEE_TITLE,
    description: GUARANTEE_SHORT,
    canonical: "/about/guarantee",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Guarantee"
      title={GUARANTEE_TITLE}
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
          <div className="font-heading text-7xl font-semibold leading-none tracking-[-0.03em] text-white">30</div>
          <div className="mt-4 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-de-magenta-ink">
            Day money-back guarantee
          </div>
          <p className="mt-4 text-sm text-white/65">On managed services only.</p>
        </div>
      }
    >
      <FactStrip
        label="The guarantee at a glance"
        facts={[
          { title: "30 days", text: "From your managed-services start date" },
          { title: "100% refund", text: "Of managed-service fees for that period" },
          { title: "Not covered", text: "Hardware, kits, and third-party licenses" },
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
                {GUARANTEE_TITLE}
              </h2>
            </div>
            <div className="lg:col-span-8 max-w-[68ch] space-y-8 text-[#3A3448]">
              <p className="text-lg leading-relaxed">{GUARANTEE_INTRO}</p>

              <section>
                <h3 className="font-heading text-xl font-semibold text-[#1A1228]">How it works</h3>
                <p className="mt-3 leading-relaxed">{GUARANTEE_HOW_IT_WORKS}</p>
              </section>

              <section>
                <h3 className="font-heading text-xl font-semibold text-[#1A1228]">What's covered</h3>
                <p className="mt-3 leading-relaxed">{GUARANTEE_WHATS_COVERED}</p>
              </section>

              <section>
                <h3 className="font-heading text-xl font-semibold text-[#1A1228]">What's not covered</h3>
                <p className="mt-3 leading-relaxed">{GUARANTEE_WHATS_NOT_COVERED}</p>
              </section>

              <p className="leading-relaxed">
                {GUARANTEE_AGREEMENT_CONTROLS_BEFORE}
                <Link href={GUARANTEE_MSA_HREF} className="font-semibold text-[#A30E52] underline underline-offset-2 hover:text-[#D3126A]">
                  {GUARANTEE_MSA_LINK_TEXT}
                </Link>
                {GUARANTEE_AGREEMENT_CONTROLS_AFTER}
              </p>
            </div>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Talk to us"
        title="Call us today to see what Elite IT & Cybersecurity is all about"
        showPhone={false}
        primary={{ label: PUBLIC_PHONE_CTA.numberLabel, href: PUBLIC_PHONE_CTA.href, testId: "link-phone" }}
        secondary={{ label: "Client Bill of Rights", href: "/about/client-bill-of-rights", testId: "link-bill-of-rights" }}
      />
    </PageTemplate>
  );
}
