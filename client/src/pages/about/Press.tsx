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

      <div className="mx-auto max-w-3xl space-y-12">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Boilerplate</h2>
          <p className="rounded-lg border border-de-hairline bg-de-raised p-5 leading-relaxed text-white/80">
            Digerati Experts is an Arizona-based managed IT and managed security provider helping
            small and mid-size organizations protect operations, patient and client data, and
            compliance readiness. The firm combines managed IT, cybersecurity, and documentation into
            one accountable program for businesses that need enterprise-grade controls without a large
            internal IT department. Headquarters: Chandler, Arizona.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Official NAP (use exactly)</h2>
          <address className="not-italic rounded-lg border border-de-hairline bg-de-raised p-5 leading-relaxed text-white/85">
            {NAP.name}
            <br />
            {NAP.street}
            <br />
            {NAP.city}, {NAP.region} {NAP.postal}
            <br />
            Phone:{" "}
            <a className="text-de-accent-ink underline-offset-2 hover:underline" href={PRIMARY_PHONE.telHref}>
              {NAP.phone}
            </a>
            <br />
            Email:{" "}
            <a className="text-de-accent-ink underline-offset-2 hover:underline" href={`mailto:${NAP.email}`}>
              {NAP.email}
            </a>
            <br />
            Web:{" "}
            <a className="text-de-accent-ink underline-offset-2 hover:underline" href="https://digeratiexperts.com">
              https://digeratiexperts.com
            </a>
          </address>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Linkable resources</h2>
          <ul className="list-disc space-y-2 pl-5 text-white/80">
            <li>
              <Link href="/resources/case-studies" className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
                Case studies
              </Link>
            </li>
            <li>
              <Link href="/resources/blog" className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
                Security & IT blog
              </Link>
            </li>
            <li>
              <Link href="/trust/trust-center" className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
                Trust center
              </Link>
            </li>
            <li>
              <Link href="/book" className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
                Free risk assessment
              </Link>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Media contact</h2>
          <p className="text-white/75">
            Interview and citation requests:{" "}
            <a className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink" href={`mailto:${NAP.email}?subject=Media%20inquiry`}>
              {NAP.email}
            </a>{" "}
            · {NAP.phone}
          </p>
        </section>
      </div>
    </PageTemplate>
  );
}
