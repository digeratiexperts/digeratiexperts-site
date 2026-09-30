import { Link } from "wouter";
import { Phone, CheckCircle2 } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function Guarantee() {
  useSEO({
    title: "100% Money-Back Guarantee",
    description:
      "Digerati Experts 30-day, no-questions-asked money-back guarantee on managed IT and cybersecurity services.",
    canonical: "/about/guarantee",
  });

  return (
    <PageTemplate
      title="100% Money-Back Guarantee"
      subtitle="No-Risk. No-Small-Print. No Questions Asked."
      breadcrumbs={[{ label: "About" }, { label: "Guarantee" }]}
    >
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start">
          <div className="order-2 flex-1 lg:order-1">
            <p className="mb-6 text-lg leading-relaxed text-white/80">
              Because we are ardently committed to deliver <span className="font-semibold text-de-accent-ink">excellence</span> in
              IT services and cybersecurity, keeping our commitments and <span className="font-semibold text-de-accent-ink">exceeding</span> our
              clients' expectations, we stand behind our work with a 100%, no-small-print, no weasel clause guarantee:
            </p>

            <div className="mb-8 rounded-xl border border-de-hairline bg-de-raised p-6">
              <p className="mb-6 leading-relaxed text-white/80">
                Partner with Digerati Experts as your IT and cybersecurity provider. If you are not
                over-the-top thrilled with our support, customer service, or problem-resolution by the
                end of the first 30 days, you can cancel your agreement and we'll refund 100% of your
                services fees, no questions asked. We'll also release you from any contract or project
                you hired us to deliver without penalties.
              </p>
              <p className="leading-relaxed text-white/80">
                We're the <span className="font-semibold text-white">only</span> IT firm in the Phoenix area that offers this bold guarantee
                because we're confident you'll be <span className="font-semibold text-white">thrilled</span> with the level of support and
                service you receive. We also believe this guarantee keeps us <span className="font-semibold text-white">sharp</span> and
                focused on ensuring everything is done right, on time and to your complete satisfaction.
                Why risk hiring anyone else?
              </p>
            </div>

            <div className="space-y-3">
              {[
                "30-day risk-free trial period",
                "100% refund of service fees if not satisfied",
                "Release from contracts without penalties",
                "No questions asked, no fine print",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                  <span className="text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 shrink-0 lg:order-2">
            <div className="relative h-56 w-56 md:h-64 md:w-64" data-testid="guarantee-badge">
              <div className="absolute inset-2 flex items-center justify-center rounded-full border border-de-hairline bg-de-raised">
                <div className="flex h-[85%] w-[85%] flex-col items-center justify-center rounded-full bg-white p-4 text-center">
                  <div className="text-5xl font-bold leading-none text-[#030228] md:text-6xl">100%</div>
                  <div className="mt-2 rounded-full bg-[#D3126A] px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white md:text-base">
                    Money Back
                  </div>
                  <div className="mt-2 text-sm font-bold uppercase tracking-wide text-[#030228] md:text-base">
                    Guarantee
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center">
          <p className="mb-4 text-xl text-white">Call us today to see what Elite IT & Cybersecurity is all about</p>
          <a
            href={PRIMARY_PHONE.telHref}
            className="inline-flex items-center gap-3 text-2xl font-bold text-white md:text-3xl"
            data-testid="link-phone"
          >
            <Phone className="h-6 w-6" />
            {PRIMARY_PHONE.display}
          </a>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95">
              <Link href="/about/client-bill-of-rights" data-testid="link-bill-of-rights">
                Client Bill of Rights
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
