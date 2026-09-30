// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiNewsletterSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { Mail, Shield, Lock, TrendingUp, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { IconWell } from "@/components/visual/IconWell";
import { GREATER_PHOENIX_CITIES } from "@/data/greaterPhoenixCities";

const chipClass =
  "inline-flex min-h-11 items-center rounded-lg border border-[var(--de-hairline)] bg-transparent px-3.5 text-base text-white/80 transition-colors hover:border-[#D3126A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]";

const cityChipClass =
  "inline-flex h-full min-h-12 w-full items-center justify-center rounded-lg border bg-transparent px-4 py-5 text-lg font-medium text-white/80 transition-colors hover:border-[#D3126A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] sm:min-h-16 md:min-h-20 md:text-xl";

const complianceItems = [
  "HIPAA-aligned security and compliance support",
  "SOC 2 readiness and control alignment",
  "Cyber insurance readiness",
  "Security and compliance reporting",
];

const partnerMarks = ["Microsoft Partner", "Apple Consultants"];

const locations = GREATER_PHOENIX_CITIES;

const benefits = [
  { icon: Shield, label: "Security Alerts" },
  { icon: Lock, label: "Best Practices" },
  { icon: TrendingUp, label: "Industry Trends" },
  { icon: Users, label: "Expert Insights" },
];

export const DigeratiNewsletterSection = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to subscribe");
      }

      toast({
        title: "Successfully Subscribed!",
        description: "You'll receive our security updates and expert insights.",
        variant: "default",
      });

      setEmail("");
      setIsSubscribed(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="newsletter"
      className="de-dark-chapter de-chapter-hairline de-field-grain relative overflow-hidden py-14 md:py-20 lg:py-24"
    >
      <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <div className="mb-10 md:mb-12">
            <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
              Security &amp; Compliance Support
              <span className="text-[#D3126A]" aria-hidden="true">
                :
              </span>
            </h2>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/55">
              Framework names describe customer requirements Digerati Experts helps organizations address —
              not certifications DE holds.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {complianceItems.map((item) => (
                <li key={item}>
                  <span className={chipClass}>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {partnerMarks.map((name) => (
                <span
                  key={name}
                  className="inline-flex min-h-11 items-center rounded-lg border border-[var(--de-hairline)] px-3 text-base text-white/65"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="rounded-2xl border border-[var(--de-hairline)] bg-[var(--de-surface)] p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <IconWell icon={Mail} size="sm" surface="dark" />
                <span className="text-base font-medium uppercase tracking-[0.16em] text-white/60">
                  Monthly · Arizona operators
                </span>
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                Stay Updated
                <span className="text-[#D3126A]" aria-hidden="true">
                  :
                </span>
              </h2>
              <p className="mt-2 text-base leading-relaxed text-white/55 md:text-lg">
                Get the latest cybersecurity insights and IT tips delivered to your inbox.
              </p>

              <div className="mt-6">
                {isSubscribed ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-start gap-3 rounded-xl border border-[var(--de-hairline)] p-5"
                    data-testid="newsletter-success"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D3126A]/40">
                      <Shield className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">You&apos;re Subscribed!</h3>
                    <p className="text-base text-white/55">
                      Check your inbox for a confirmation email. Welcome to our security community!
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => setIsSubscribed(false)}
                      className="h-11 px-0 text-[#D3126A] hover:bg-transparent hover:text-[#f0187a]"
                    >
                      Subscribe another email
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="homepage-newsletter-email" className="sr-only">
                      Email address
                    </label>
                    <Input
                      id="homepage-newsletter-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-newsletter-email"
                      className="de-paper-field h-12 min-h-11 flex-1 border-[var(--de-paper-hairline)] bg-[var(--de-paper)] text-base text-[#1A1228] shadow-none caret-[#1A1228] placeholder:text-black/50 hover:border-black/25 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/60 md:text-base"
                      disabled={isSubmitting}
                      required
                    />
                    <Button
                      type="submit"
                      size="lg"
                      data-testid="button-newsletter-submit"
                      className="h-12 px-6 bg-[#D3126A] text-base font-semibold text-white shadow-none hover:bg-[#e01874] hover:shadow-none hover:translate-y-0 focus-visible:ring-[#D3126A]/70"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          Subscribe
                          <Mail className="ml-2 h-5 w-5" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {benefits.map((benefit) => (
                  <span key={benefit.label} className={chipClass}>
                    <benefit.icon className="mr-2 h-4 w-4 text-[#D3126A]" aria-hidden="true" />
                    {benefit.label}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-base text-white/50">
                Monthly security notes for Arizona operators.
                <br />
                <span className="text-base text-white/45">Unsubscribe anytime. We respect your privacy.</span>
              </p>
            </div>

            <div className="flex h-full flex-col rounded-2xl border border-[var(--de-hairline)] bg-[var(--de-surface)] p-6 md:p-8">
              <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
                Serving Greater Phoenix
                <span className="text-[#D3126A]" aria-hidden="true">
                  :
                </span>
              </h2>
              <div className="mt-6 grid flex-1 grid-cols-2 content-stretch gap-3 sm:grid-cols-3">
                {locations.map((location) => (
                  <a
                    key={location.name}
                    href={location.href}
                    className={`${cityChipClass} ${
                      location.slug === "chandler-az"
                        ? "border-[#D3126A] text-white shadow-[inset_0_0_0_1px_#D3126A]"
                        : "border-[var(--de-hairline)]"
                    }`}
                    data-city={location.name.toLowerCase()}
                    data-testid={`newsletter-location-${location.name.toLowerCase()}`}
                  >
                    {location.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
