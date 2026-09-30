// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiContactSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Linkedin, Facebook, Twitter, Loader2, Clock, Shield, ArrowRight } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { IconWell } from "@/components/visual/IconWell";
import {
  COMPANY,
  COMPANY_SOCIAL,
  PRIMARY_PHONE,
  formatAddressOneLine,
} from "@/data/companyContact";
// Closing bookend (Joe 2026-08-31): the hero's Phoenix city-lights plate
// returns behind the contact chapter, fainter still, so the page ends where
// it began. 50KB WebP.
import contactBgImage from "@assets/de-hero-arizona-dusk-1600.webp";

const contactFormSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string()
    .regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, "Please enter a valid phone number"),
  company: z.string().optional(),
  service: z.string().optional(),
  message: z.string()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must be less than 500 characters")
    .optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const directoryItems = [
  {
    icon: Mail,
    label: "Email",
    value: COMPANY.email,
    href: `mailto:${COMPANY.email}`,
    testId: "contact-email",
    external: false,
  },
  {
    icon: Phone,
    label: "Phone",
    value: PRIMARY_PHONE.display,
    href: PRIMARY_PHONE.telHref,
    testId: "contact-phone",
    external: false,
  },
  {
    icon: MapPin,
    label: "Office",
    value: formatAddressOneLine(),
    href: COMPANY.mapsUrl,
    testId: "contact-address",
    external: true,
  },
] as const;

const contactSocials = [
  { ...COMPANY_SOCIAL.linkedin, icon: Linkedin, testId: "social-linkedin" },
  { ...COMPANY_SOCIAL.facebook, icon: Facebook, testId: "social-facebook" },
  { ...COMPANY_SOCIAL.twitter, icon: Twitter, testId: "social-twitter" },
] as const;

const fieldClass =
  "h-11 bg-white border-[var(--de-paper-hairline)] text-[#1A1228] placeholder:text-black/55 focus-visible:ring-2 focus-visible:ring-[#D3126A]/40 focus-visible:border-[#D3126A]";

export const DigeratiContactSection = ({
  headingAs = "h2",
}: {
  headingAs?: "h1" | "h2";
} = {}): JSX.Element => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      service: "",
      message: "",
    },
  });

  const handleSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message");
      }

      analytics.contactFormSubmitted(data.service || "general");
      toast({
        title: "Message Sent Successfully!",
        description: "We'll get back to you within 24 hours.",
        variant: "default",
      });

      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again or call us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="de-dark-well de-chapter-hairline de-field-grain relative overflow-hidden py-16 lg:py-24"
      data-testid="homepage-contact-chapter"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={contactBgImage}
          alt=""
          width={1600}
          height={1067}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: 0.14,
            objectPosition: "center 70%",
            maskImage: "linear-gradient(to top, black 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, black 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
          }}
        />
        {/* Hero violet drift echo — keeps the closing chapter in the same
            atmosphere family as the opening field. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(87,68,255,0.10), transparent 34%), radial-gradient(circle at 88% 80%, rgba(211,18,106,0.06), transparent 30%)",
          }}
        />
      </div>

      <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <motion.div
            className="lg:col-span-6"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-[#F04C97]">
              Contact
            </p>
            {headingAs === "h1" ? (
              <h1 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
                Ready to Secure Your Business<span className="text-de-accent-ink" aria-hidden="true">?</span>
              </h1>
            ) : (
              <h2 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
                Ready to Secure Your Business?
              </h2>
            )}
            <p className="mb-8 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
              Located in the heart of Chandler, we&apos;re your local cybersecurity experts.
              Whether you need immediate help or want to explore our services, we&apos;re here for you.
            </p>

            <div className="mb-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <a
                href="/book"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#D3126A] px-6 py-2.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                data-testid="contact-cta-assessment"
              >
                {CTA.primary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={PRIMARY_PHONE.telHref}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                data-testid="contact-cta-call"
              >
                Call {PRIMARY_PHONE.display}
              </a>
            </div>

            <div className="grid border-t border-de-hairline md:grid-cols-2">
              {directoryItems.map((item) => (
                <a
                  key={item.testId}
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  data-testid={item.testId}
                  className={`group flex items-start gap-4 border-b border-de-hairline py-4 transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] ${
                    item.testId === "contact-address" ? "md:col-span-2" : ""
                  } ${item.testId === "contact-phone" ? "md:border-l md:pl-4" : ""}`}
                >
                  <IconWell icon={item.icon} size="sm" surface="dark" />
                  <span className="min-w-0 pt-1">
                    <span className="block text-base font-semibold uppercase tracking-[0.16em] text-white/50">
                      {item.label}
                    </span>
                    <span className="mt-1 block break-words text-base text-white/80 transition-colors group-hover:text-white md:text-lg">
                      {item.value}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            <div className="mt-8" data-testid="contact-office-hours">
              <div className="mb-3 flex items-center gap-3">
                <IconWell icon={Clock} size="sm" surface="dark" />
                <h3 className="text-base font-semibold text-white">Office Hours</h3>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-base font-medium text-white/80 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 md:text-lg md:font-normal md:text-white/60">
                <dt>Monday - Friday</dt>
                <dd className="text-white/80">7:00 AM - 6:00 PM MST</dd>
                <dt>Saturday &amp; Sunday</dt>
                <dd className="text-white/80">Emergency Support Only</dd>
              </dl>
              <p className="mt-4 flex items-start gap-2 text-base font-medium text-de-accent-ink">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>24/7 Security Operations Center Always Active</span>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="text-base text-white/55">Follow us:</span>
              {contactSocials.map((social) => (
                <a
                  key={social.testId}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={social.testId}
                  aria-label={social.name}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-de-hairline bg-de-raised text-white/60 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                >
                  <social.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-6"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="de-paper-lift-lg rounded-2xl p-6 md:p-8">
              <h3 className="font-heading text-xl font-semibold tracking-[-0.02em] text-[#1A1228]">
                Get in Touch
              </h3>
              <p className="mb-6 mt-1 text-base text-black/55">
                Tell us about the environment. We&apos;ll follow up on a Cyber Risk Assessment — no hard sell.
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem required>
                        <FormLabel className="text-base font-medium text-[#1A1228]">Your Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
                            data-testid="input-contact-name"
                            className={fieldClass}
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem required>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Business Email *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@company.com"
                              data-testid="input-contact-email"
                              className={fieldClass}
                              disabled={isSubmitting}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem required>
                          <FormLabel className="text-base font-medium text-[#1A1228]">Phone Number *</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="(480) 000-0000"
                              data-testid="input-contact-phone"
                              className={fieldClass}
                              disabled={isSubmitting}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium text-[#1A1228]">Company Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your Company Inc."
                            data-testid="input-contact-company"
                            className={fieldClass}
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="service"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium text-[#1A1228]">Service Interested In</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger
                              className="h-11 border-[var(--de-paper-hairline)] bg-white text-base text-[#1A1228] focus:ring-2 focus:ring-[#D3126A]/40 data-[placeholder]:text-black/55"
                              data-testid="select-contact-service"
                            >
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-[var(--de-paper-hairline)] bg-white">
                            <SelectItem value="managed-security" className="text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]">Managed Security Services</SelectItem>
                            <SelectItem value="managed-it" className="text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]">Managed IT Services</SelectItem>
                            <SelectItem value="compliance" className="text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]">Compliance & Governance</SelectItem>
                            <SelectItem value="incident-response" className="text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]">Incident Response</SelectItem>
                            <SelectItem value="assessment" className="text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]">Security Assessment</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium text-[#1A1228]">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about your security needs..."
                            rows={4}
                            data-testid="textarea-contact-message"
                            className="resize-none border-[var(--de-paper-hairline)] bg-white text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    className="h-11 w-full text-base font-semibold bg-[#1A1228] text-white transition-colors hover:bg-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2"
                    data-testid="button-send-message"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Message"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
