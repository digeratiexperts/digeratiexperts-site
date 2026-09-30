import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, Clock, MapPin, Video, ArrowRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { IconWell } from "@/components/visual/IconWell";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

export default function ThankYouSuccess() {
  useSEO({
    title: "Thank You",
    description:
      "Thank you for contacting Digerati Experts. We will be in touch shortly to discuss your IT and cybersecurity needs.",
    noIndex: true,
  });

  return (
    <PageTemplate
      title="Thank You"
      subtitle="Your form has been successfully submitted. Our team will review it and get back to you shortly."
      icon={<CheckCircle className="h-8 w-8" />}
      breadcrumbs={[{ label: "Contact", href: "/contact" }, { label: "Thank You" }]}
      showBackButton={false}
    >
      <div className="mx-auto max-w-2xl space-y-10">
        <p className="sr-only" data-testid="text-thank-you-title">
          Thank You!
        </p>
        <p className="sr-only" data-testid="text-thank-you-message">
          Your form has been successfully submitted. Our team will review it and get back to you shortly.
        </p>

        <section className={`p-8 md:p-10 ${cardClass}`}>
          <h2 className="mb-4 text-center text-2xl font-bold text-white md:text-3xl">
            Here&apos;s What You Can Do Next
          </h2>
          <p className="mb-2 text-center text-white/70">
            Book a private session with our cybersecurity consultant.
          </p>
          <p className="mb-2 text-center text-white/70">
            Identify how you can better protect your business from cyber threats.
          </p>
          <p className="mb-8 text-center text-white/70">
            If you qualify, you will receive a <strong className="text-de-accent-ink">free security assessment</strong>.
          </p>

          <div className="border-t border-de-hairline" />

          <div className="mt-8 text-center">
            <div className="mb-4 flex justify-center">
              <IconWell icon={Calendar} size="md" surface="dark" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">Schedule Your Consultation</h3>
            <p className="mb-6 text-sm text-white/65">
              Thank you for your interest. Click below to book a time that works for you.
              <br />
              Call our office at{" "}
              <a href={PRIMARY_PHONE.telHref} className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
                {PRIMARY_PHONE.display}
              </a>{" "}
              if you have any questions.
            </p>

            <div className={`mx-auto mb-6 max-w-sm p-6 text-left ${insetClass}`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/80">
                  <Clock className="h-4 w-4 text-white/55" aria-hidden="true" />
                  <span className="text-sm">30 Minutes</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <Video className="h-4 w-4 text-white/55" aria-hidden="true" />
                  <span className="text-sm">Video Conference or Phone Call</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <MapPin className="h-4 w-4 text-white/55" aria-hidden="true" />
                  <span className="text-sm">America/Phoenix (MST)</span>
                </div>
              </div>
            </div>

            <Button asChild size="lg" variant="brand" className="h-12 px-8 text-lg" data-testid="button-book-consultation">
              <a href="/book">
                {CTA.primary}
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </a>
            </Button>
          </div>

          <div className="my-8 border-t border-de-hairline" />

          <div className="text-center">
            <p className="mb-4 text-sm text-white/55">Already have an appointment? Add it to your calendar:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
                data-testid="button-google-calendar"
                asChild
              >
                <a href="https://calendar.google.com">
                  <SiGoogle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Google Calendar
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
                data-testid="button-outlook-calendar"
                asChild
              >
                <a href="https://outlook.live.com/calendar">
                  <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                  Outlook Calendar
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
                data-testid="button-apple-calendar"
                asChild
              >
                <a href="https://www.icloud.com/calendar">
                  <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                  iCloud Calendar
                </a>
              </Button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/#google-reviews"
            className={`flex items-center gap-2 px-4 py-3 transition-colors hover:border-white/25 ${insetClass}`}
            data-testid="link-thank-you-reviews"
          >
            <SiGoogle className="h-5 w-5 text-white" aria-hidden="true" />
            <span>
              <span className="block text-xs font-semibold text-white">Google Reviews</span>
              <span className="block text-xs text-white/55 underline">See client reviews</span>
            </span>
          </a>
          <div className={`flex items-center gap-2 px-4 py-3 ${insetClass}`}>
            <SiGoogle className="h-5 w-5 text-white" aria-hidden="true" />
            <span className="text-xs font-semibold text-white">Google Partner</span>
          </div>
        </div>

        <ConversionPathBar
          headline="Book your Cyber Risk Assessment"
          body="Pick a time. We review identity, endpoints, email, backups, and operating reality — then recommend a fit."
          primaryHref="/book"
          primaryLabel={CTA.primary}
          primaryTestId="button-thank-you-assessment"
        />
      </div>
    </PageTemplate>
  );
}
