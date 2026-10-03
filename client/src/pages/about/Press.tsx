import { Chapter, Container } from "@/components/site/chapters";
import { PageTemplate } from "@/components/PageTemplate";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";

const NAP = {
  name: "Digerati Experts",
  street: "3165 S Alma School Rd Suite 29",
  city: "Chandler",
  region: "AZ",
  postal: "85248",
  phone: PRIMARY_PHONE.display,
  email: "info@digeratiexperts.com",
};

export default function Press() {
  useSEO({
    title: "Press & Media",
    description:
      "Official media kit and boilerplate for Digerati Experts — Arizona MSP/MSSP for managed IT, cybersecurity, and compliance. Accurate NAP and brand facts for journalists and partners.",
    canonical: "/about/press",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Press & media"
      title="Press & media"
      subtitle="Use this page for accurate company facts, citations, and interview requests. Please do not invent metrics, client names, or certifications not listed here."
      breadcrumbs={[{ label: "About" }, { label: "Press & Media" }]}
    >
      <JsonLd
        id="press-org"
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Press & Media — Digerati Experts",
          url: "https://digeratiexperts.com/about/press",
          mainEntity: {
            "@type": "Organization",
            name: NAP.name,
            url: "https://digeratiexperts.com",
            email: NAP.email,
            telephone: PRIMARY_PHONE.schemaTelephone,
            address: {
              "@type": "PostalAddress",
              streetAddress: NAP.street,
              addressLocality: NAP.city,
              addressRegion: NAP.region,
              postalCode: NAP.postal,
              addressCountry: "US",
            },
          },
        }}
      />


      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="border-t border-[var(--de-paper-hairline)]">
            <section className="grid gap-5 border-b border-[var(--de-paper-hairline)] py-8 lg:grid-cols-12 lg:gap-14 lg:py-10">
              <h2 className="font-heading text-2xl font-semibold text-[#1A1228] lg:col-span-4">Boilerplate</h2>
              <p className="max-w-[68ch] rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6 leading-relaxed text-[#3A3448] lg:col-span-8">
                Digerati Experts is an Arizona-based managed IT and managed security provider helping
                small and mid-size organizations protect operations, patient and client data, and
                compliance readiness. The firm combines managed IT, cybersecurity, and documentation into
                one accountable program for businesses that need enterprise-grade controls without a large
                internal IT department. Headquarters: Chandler, Arizona.
              </p>
            </section>

            <section className="grid gap-5 border-b border-[var(--de-paper-hairline)] py-8 lg:grid-cols-12 lg:gap-14 lg:py-10">
              <h2 className="font-heading text-2xl font-semibold text-[#1A1228] lg:col-span-4">Official NAP (use exactly)</h2>
              <address className="max-w-[68ch] rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6 not-italic leading-relaxed text-[#1A1228] lg:col-span-8">
                {NAP.name}
                <br />
                {NAP.street}
                <br />
                {NAP.city}, {NAP.region} {NAP.postal}
                <br />
                Phone:{" "}
                <a className="inline-flex min-h-11 items-center text-de-magenta-paper-ink underline decoration-de-magenta-paper-ink/50 underline-offset-4 hover:decoration-de-magenta-paper-ink" href={PRIMARY_PHONE.telHref}>
                  {NAP.phone}
                </a>
                <br />
                Email:{" "}
                <a className="inline-flex min-h-11 items-center text-de-magenta-paper-ink underline decoration-de-magenta-paper-ink/50 underline-offset-4 hover:decoration-de-magenta-paper-ink" href={`mailto:${NAP.email}`}>
                  {NAP.email}
                </a>
                <br />
                Web:{" "}
                <a className="inline-flex min-h-11 items-center text-de-magenta-paper-ink underline decoration-de-magenta-paper-ink/50 underline-offset-4 hover:decoration-de-magenta-paper-ink" href="https://digeratiexperts.com">
                  https://digeratiexperts.com
                </a>
              </address>
            </section>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <div className="border-t border-[var(--de-hairline)]">
            <section className="grid gap-5 border-b border-[var(--de-hairline)] py-8 lg:grid-cols-12 lg:gap-14 lg:py-10">
              <h2 className="font-heading text-2xl font-semibold text-white lg:col-span-4">Linkable resources</h2>
              <ul className="list-disc space-y-2 pl-5 text-white/80 lg:col-span-8">
                <li>
                  <Link href="/resources/case-studies" className="text-de-magenta-ink underline decoration-de-magenta-ink/50 underline-offset-4 hover:decoration-de-magenta-ink">
                    Case studies
                  </Link>
                </li>
                <li>
                  <Link href="/resources/blog" className="text-de-magenta-ink underline decoration-de-magenta-ink/50 underline-offset-4 hover:decoration-de-magenta-ink">
                    Security & IT blog
                  </Link>
                </li>
                <li>
                  <Link href="/trust/trust-center" className="text-de-magenta-ink underline decoration-de-magenta-ink/50 underline-offset-4 hover:decoration-de-magenta-ink">
                    Trust center
                  </Link>
                </li>
                <li>
                  <Link href="/book" className="text-de-magenta-ink underline decoration-de-magenta-ink/50 underline-offset-4 hover:decoration-de-magenta-ink">
                    Free risk assessment
                  </Link>
                </li>
              </ul>
            </section>

            <section className="grid gap-5 border-b border-[var(--de-hairline)] py-8 lg:grid-cols-12 lg:gap-14 lg:py-10">
              <h2 className="font-heading text-2xl font-semibold text-white lg:col-span-4">Media contact</h2>
              <p className="text-white/80 lg:col-span-8">
                Interview and citation requests:{" "}
                <a className="text-de-magenta-ink underline decoration-de-magenta-ink/50 underline-offset-4 hover:decoration-de-magenta-ink" href={`mailto:${NAP.email}?subject=Media%20inquiry`}>
                  {NAP.email}
                </a>{" "}
                · {NAP.phone}
              </p>
            </section>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
