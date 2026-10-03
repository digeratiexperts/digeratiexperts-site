import { Calendar, Clock, MapPin, Video } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ClosingCta,
  HeroActions,
  buttonSecondary,
  Eyebrow,
} from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const calendars = [
  { href: "https://calendar.google.com", label: "Google Calendar", testId: "button-google-calendar", icon: "google" },
  { href: "https://outlook.live.com/calendar", label: "Outlook Calendar", testId: "button-outlook-calendar", icon: "cal" },
  { href: "https://www.icloud.com/calendar", label: "iCloud Calendar", testId: "button-apple-calendar", icon: "cal" },
] as const;

export default function ThankYouSuccess() {
  useSEO({
    title: "Thank You",
    description:
      "Thank you for contacting Digerati Experts. We will be in touch shortly to discuss your IT and cybersecurity needs.",
    noIndex: true,
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Submitted"
      title="Thank You"
      subtitle="Your form has been successfully submitted. Our team will review it and get back to you shortly."
      breadcrumbs={[{ label: "Contact", href: "/contact" }, { label: "Thank You" }]}
      showBackButton={false}
    >
      <p className="sr-only" data-testid="text-thank-you-title">
        Thank You!
      </p>
      <p className="sr-only" data-testid="text-thank-you-message">
        Your form has been successfully submitted. Our team will review it and get back to you shortly.
      </p>

      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <section className="lg:col-span-6">
              <Eyebrow tone="paper" className="mb-4">
                What happens next
              </Eyebrow>
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl">
                Here&apos;s What You Can Do Next
              </h2>
              <div className="mt-6 max-w-[60ch] space-y-3 text-lg leading-relaxed text-[#3A3448]">
                <p>Book a private session with our cybersecurity consultant.</p>
                <p>Identify how you can better protect your business from cyber threats.</p>
                <p>
                  If you qualify, you will receive a{" "}
                  <strong className="text-de-magenta-paper-ink">free security assessment</strong>.
                </p>
              </div>
            </section>

            <section className="lg:col-span-6">
              <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6 md:p-8">
                <h3 className="font-heading text-xl font-semibold text-[#1A1228]">Schedule Your Consultation</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3A3448]">
                  Thank you for your interest. Click below to book a time that works for you.
                  <br />
                  Call our office at{" "}
                  <a href={PRIMARY_PHONE.telHref} className="font-medium text-de-magenta-paper-ink underline underline-offset-4">
                    {PRIMARY_PHONE.display}
                  </a>{" "}
                  if you have any questions.
                </p>

                <ul className="my-6 space-y-3 border-y border-[var(--de-paper-hairline)] py-5 text-sm text-[#1A1228]">
                  <li className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-de-magenta-paper-ink" aria-hidden="true" />
                    30 Minutes
                  </li>
                  <li className="flex items-center gap-3">
                    <Video className="h-4 w-4 text-de-magenta-paper-ink" aria-hidden="true" />
                    Video Conference or Phone Call
                  </li>
                  <li className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-de-magenta-paper-ink" aria-hidden="true" />
                    America/Phoenix (MST)
                  </li>
                </ul>

                <HeroActions
                  tone="paper"
                  primary={{ label: CTA.primary, href: "/book", testId: "button-book-consultation" }}
                />

                <p className="mb-3 mt-8 text-sm text-black/60">Already have an appointment? Add it to your calendar:</p>
                <div className="flex flex-wrap gap-3">
                  {calendars.map((c) => (
                    <a key={c.testId} href={c.href} className={buttonSecondary("paper")} data-testid={c.testId}>
                      {c.icon === "google" ? (
                        <SiGoogle className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                      )}
                      {c.label}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well" compact>
        <Container>
          <ul className="flex flex-wrap items-center gap-4">
            <li>
              <a
                href="/#google-reviews"
                className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--de-hairline)] bg-de-raised px-4 py-3 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                data-testid="link-thank-you-reviews"
              >
                <SiGoogle className="h-5 w-5 text-white" aria-hidden="true" />
                <span>
                  <span className="block text-xs font-semibold text-white">Google Reviews</span>
                  <span className="block text-xs text-white/65 underline">See client reviews</span>
                </span>
              </a>
            </li>
            <li className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--de-hairline)] bg-de-raised px-4 py-3">
              <SiGoogle className="h-5 w-5 text-white" aria-hidden="true" />
              <span className="text-xs font-semibold text-white">Google Partner</span>
            </li>
          </ul>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Book your Cyber Risk Assessment"
        lede="Pick a time. We review identity, endpoints, email, backups, and operating reality — then recommend a fit."
        primary={{ label: CTA.primary, href: "/book", testId: "button-thank-you-assessment" }}
      />
    </PageTemplate>
  );
}
