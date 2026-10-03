import { PageTemplate } from "@/components/PageTemplate";
import { Eye, Mail, Phone, MapPin, Monitor, Ear, Hand, Brain } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  Eyebrow,
} from "@/components/site/chapters";

const accessibilityFeatures = [
  "Keyboard navigation support",
  "Alternative text for images",
  "Semantic HTML structure",
  "Clear heading hierarchy",
  "Sufficient color contrast ratios",
  "Readable fonts and text sizes",
  "Skip navigation links",
  "ARIA labels and landmarks",
];

const assistiveTech = [
  { icon: Monitor, name: "Screen readers (JAWS, NVDA, VoiceOver)" },
  { icon: Eye, name: "Screen magnification software" },
  { icon: Ear, name: "Speech recognition software" },
  { icon: Hand, name: "Keyboard-only navigation" },
];

const supportedUsers = [
  { icon: Eye, text: "Blind or have low vision" },
  { icon: Ear, text: "Deaf or have hearing loss" },
  { icon: Hand, text: "Living with mobility impairments" },
  { icon: Brain, text: "Living with cognitive disabilities" },
];

export default function Accessibility() {
  useSEO({
    title: "Accessibility Statement",
    description:
      "Digerati Experts accessibility statement: WCAG 2.1 Level AA target, known limitations, and how to report barriers.",
    canonical: "/trust/accessibility",
  });

  const contactCard =
    "flex items-start gap-3 rounded-xl border border-[var(--de-paper-hairline)] bg-white p-5 text-[#1A1228]";
  const contactLink = "inline-flex min-h-11 items-center underline underline-offset-4 hover:text-de-magenta-paper-ink";

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Trust · Accessibility"
      title="Accessibility Statement"
      subtitle="Our Commitment to Digital Accessibility"
      breadcrumbs={[{ label: "Trust", href: "/trust/trust-center" }, { label: "Accessibility" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Report Accessibility Issue", href: "mailto:accessibility@digeratiexperts.com?subject=Accessibility Feedback" }}
            secondary={{ label: "Known limitations", href: "#known-limitations" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Conformance"
          rows={[
            { label: "Standard", value: "WCAG 2.1 Level AA" },
            { label: "Status", value: "Working toward conformance" },
            {
              label: "Feedback",
              value: (
                <a href="mailto:accessibility@digeratiexperts.com" className="underline-offset-4 hover:underline">
                  accessibility@digeratiexperts.com
                </a>
              ),
            },
            { label: "Response", value: "Within 2 business days" },
          ]}
        />
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <Eyebrow tone="paper" className="mb-4">Our commitment</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl">Our Commitment</h2>
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-[#3A3448]">
                Digerati Experts is committed to ensuring digital accessibility for people with disabilities. We are
                continually improving the user experience for everyone and applying the relevant accessibility standards.
              </p>
            </div>
            <section className="lg:col-span-7">
              <h2 className="font-heading text-2xl font-semibold text-[#1A1228]">Conformance Status</h2>
              <p className="mt-4 max-w-[68ch] leading-relaxed text-[#3A3448]">
                We are working toward conformance with the{" "}
                <strong className="text-[#1A1228]">Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>. These
                guidelines explain how to make web content more accessible to people with disabilities.
              </p>
              <p className="mb-6 mt-4 max-w-[68ch] leading-relaxed text-[#3A3448]">
                Conformance with these guidelines helps us ensure our website is accessible to people who are:
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {supportedUsers.map((user) => {
                  const Icon = user.icon;
                  return (
                    <li key={user.text} className="flex items-center gap-3 rounded-xl border border-[var(--de-paper-hairline)] bg-white p-4 text-[#1A1228]">
                      <Icon className="h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                      <span className="text-sm">{user.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            <section className="lg:col-span-6">
              <Eyebrow tone="well" className="mb-4">In the build</Eyebrow>
              <h2 className="font-heading text-2xl font-semibold text-white md:text-3xl">Accessibility Features</h2>
              <p className="mb-6 mt-4 text-base text-white/70">Our website includes the following accessibility features:</p>
              <CheckList tone="well" columns={1} items={accessibilityFeatures} />
            </section>
            <section className="lg:col-span-6">
              <Eyebrow tone="well" className="mb-4">Assistive technology</Eyebrow>
              <h2 className="mb-6 font-heading text-2xl font-semibold text-white md:text-3xl">Compatible Assistive Technologies</h2>
              <FeatureGrid tone="well" columns={2} items={assistiveTech.map((t) => ({ icon: t.icon, title: t.name }))} />
            </section>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper" id="known-limitations" className="scroll-mt-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            <section className="lg:col-span-5">
              <h2 className="font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">Known Limitations</h2>
              <p className="mb-6 mt-4 leading-relaxed text-[#3A3448]">
                Despite our best efforts, some content may not yet be fully accessible. We are actively working to address
                these limitations:
              </p>
              <CheckList
                tone="paper"
                columns={1}
                items={[
                  "Some third-party embedded content may not meet accessibility standards",
                  "Older PDF documents may not be fully accessible (we're working to remediate these)",
                  "Some complex interactive elements are being enhanced for better screen reader support",
                ]}
              />
            </section>
            <section className="lg:col-span-7">
              <h2 className="font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">Feedback and Support</h2>
              <p className="mb-6 mt-4 max-w-[68ch] leading-relaxed text-[#3A3448]">
                We welcome your feedback on the accessibility of our website. If you encounter accessibility barriers or
                have suggestions for improvement, please let us know:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={contactCard}>
                  <Mail className="mt-3 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                  <a href="mailto:accessibility@digeratiexperts.com" className={`${contactLink} break-all`}>
                    accessibility@digeratiexperts.com
                  </a>
                </div>
                <div className={contactCard}>
                  <Phone className="mt-3 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                  <a href={PRIMARY_PHONE.telHref} className={contactLink}>
                    {PRIMARY_PHONE.display}
                  </a>
                </div>
                <div className={`${contactCard} sm:col-span-2`}>
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-[#3A3448]">{formatAddressOneLine()}</span>
                </div>
              </div>
              <p className="mt-6 text-sm text-black/60">We aim to respond to accessibility feedback within 2 business days.</p>
            </section>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        eyebrow="Feedback"
        title="Report an Accessibility Issue"
        lede={
          <>
            Your feedback helps us improve. Please report any accessibility concerns.
            <span className="mt-4 block text-sm text-white/55">
              This accessibility statement was last updated on November 6, 2025.
            </span>
          </>
        }
        primary={{
          label: "Report Accessibility Issue",
          href: "mailto:accessibility@digeratiexperts.com?subject=Accessibility Feedback",
          testId: "button-report-accessibility",
        }}
      />
    </PageTemplate>
  );
}
