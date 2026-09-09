import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  MapPin,
  Phone,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle,
  Building,
  FileCheck,
  Loader2,
  Monitor,
  Lock,
  Cloud,
  Users,
  HeadphonesIcon,
} from "lucide-react";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { MegaMenu } from "@/components/MegaMenu";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSEO } from "@/hooks/useSEO";
import { getCyberFact, formatFactSource } from "@/data/cyberAwarenessFacts";
import { CTA } from "@/lib/ctaCopy";
import { COMPANY, COMPANY_SOCIAL, PRIMARY_PHONE } from "@/data/companyContact";
import { GREATER_PHOENIX_CITIES, cityPageSlug } from "@/data/greaterPhoenixCities";
import { IconWell } from "@/components/visual/IconWell";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import heroBgImage from "@assets/de-hero-arizona-dusk.png";

const assessmentFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .regex(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, "Please enter a valid phone number"),
  company: z.string().min(2, "Company name must be at least 2 characters").max(100),
});

type AssessmentFormData = z.infer<typeof assessmentFormSchema>;

interface LocationPageProps {
  city: string;
  state: string;
  localArea: string;
  serviceRadius: string;
  title: string;
  subtitle: string;
  description: string;
  heroImage: string;
  keywordPhrase: string;
  whyChooseUs: string[];
  localProof: {
    officeLocation: string;
    yearsServing: string;
    testimonialCount: string;
    industries: string[];
  };
  serviceFocus: string[];
  neighborhoods: string[];
  cta: string;
}

const serviceIcons = [Monitor, Shield, Lock, Cloud, Users, HeadphonesIcon];

const paperFieldClass =
  "h-11 bg-white border-[var(--de-paper-hairline)] text-[#1A1228] placeholder:text-black/55 focus-visible:ring-2 focus-visible:ring-[#D3126A]/40 focus-visible:border-[#D3126A]";

const cityChipClass =
  "inline-flex h-full min-h-12 w-full items-center justify-center rounded-lg border bg-transparent px-4 py-4 text-base font-medium text-white/80 transition-colors hover:border-[#D3126A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] sm:min-h-14 md:text-lg";

export function LocationServicePage(props: LocationPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const currentSlug = cityPageSlug(props.city);

  useSEO({
    title: props.title,
    description: props.description,
    canonical: `/locations/${currentSlug}`,
  });

  useEffect(() => {
    const existingSchema = document.querySelector('script[data-schema="local-business"]');
    if (existingSchema) existingSchema.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: COMPANY.legalName,
      description: props.description,
      url: `${COMPANY.website}/locations/${currentSlug}`,
      telephone: PRIMARY_PHONE.schemaTelephone ?? PRIMARY_PHONE.display,
      email: COMPANY.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.streetAddress,
        addressLocality: COMPANY.addressLocality,
        addressRegion: COMPANY.addressRegion,
        postalCode: COMPANY.postalCode,
        addressCountry: COMPANY.addressCountry,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 33.2826,
        longitude: -111.8407,
      },
      areaServed: {
        "@type": "City",
        name: props.city,
        containedInPlace: {
          "@type": "State",
          name: "Arizona",
        },
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "07:00",
          closes: "18:00",
        },
      ],
      priceRange: "$$",
      image: "https://digeratiexperts.com/og-image.png",
      sameAs: [COMPANY_SOCIAL.linkedin.href, COMPANY_SOCIAL.facebook.href, COMPANY_SOCIAL.twitter.href],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "IT Services",
        itemListElement: props.serviceFocus.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: service,
          },
        })),
      },
    };

    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.setAttribute("data-schema", "local-business");
    scriptTag.textContent = JSON.stringify(schema);
    document.head.appendChild(scriptTag);

    return () => {
      const schemaToRemove = document.querySelector('script[data-schema="local-business"]');
      if (schemaToRemove) schemaToRemove.remove();
    };
  }, [props.description, props.city, props.serviceFocus, currentSlug]);

  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: { fullName: "", email: "", phone: "", company: "" },
  });

  const handleSubmit = async (data: AssessmentFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || "",
          company: data.company || "",
          source: `location_${props.city.toLowerCase().replace(/\s+/g, "_")}`,
          message: `${props.city} assessment request — ${props.serviceFocus || props.title}`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || "Submission failed");
      }
      toast({
        title: "Assessment Request Submitted!",
        description: `We'll contact you within 24 hours to schedule your free ${props.city} assessment.`,
      });
      form.reset();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = [
    { icon: Shield, value: "Security-first", label: "Operating model" },
    { icon: Zap, value: "<15min", label: "Response Time" },
    { icon: Clock, value: "24/7", label: "Monitoring" },
  ];

  const features = [
    { icon: FileCheck, text: "Insurance & Compliance-Ready" },
    { icon: Shield, text: "24/7 Human-Led Monitoring" },
    { icon: Building, text: `Built for ${props.city} Businesses` },
    { icon: CheckCircle, text: "Easy-to-Read Risk Reports" },
  ];

  const fadeUp = prefersReducedMotion ? {} : { opacity: 0, y: 16 };

  return (
    <>
      <MegaMenu />

      <section className="relative overflow-hidden bg-[var(--de-bg)]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <img
            src={heroBgImage}
            alt=""
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[center_82%] opacity-45"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 16%, rgba(0,0,0,0.88) 46%, black 72%)",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 16%, rgba(0,0,0,0.88) 46%, black 72%)",
            }}
          />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(90deg, rgba(5,3,18,0.92) 0%, rgba(5,3,18,0.70) 26%, rgba(5,3,18,0.22) 56%, rgba(5,3,18,0.06) 100%), linear-gradient(180deg, rgba(5,3,18,0.72) 0%, rgba(5,3,18,0.28) 34%, rgba(5,3,18,0.08) 62%, rgba(5,3,18,0.38) 100%)",
          }}
        >
          <div
            className="de-hero-glow absolute top-[8%] right-[-4%] h-[640px] w-[640px] pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 70% 35%, rgba(211, 18, 106, 0.20) 0%, transparent 64%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pt-[calc(var(--de-nav-offset)+0.5rem)] pb-12 sm:pt-[calc(var(--de-nav-offset)+1.25rem)] lg:pb-16">
          <div className="mx-auto w-[min(94vw,1680px)]">
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 xl:gap-16">
              <motion.div
                className="flex w-full flex-col gap-6"
                initial={fadeUp}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: "easeOut" }}
              >
                <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-de-hairline bg-de-raised px-3.5 py-2">
                  <MapPin className="h-4 w-4 text-[#D3126A]" aria-hidden="true" />
                  <span className="text-sm font-medium text-white/85">{props.localArea}</span>
                </div>

                <h1 className="text-[clamp(2.25rem,7vw,3.75rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
                  {props.city} Businesses
                  <br />
                  Deserve <span className="text-[#D3126A]">Better IT.</span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{props.description}</p>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-2">
                  {features.map((feature) => (
                    <div key={feature.text} className="flex min-w-0 items-start gap-1.5">
                      <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-pink-400/90" aria-hidden="true" />
                      <span className="text-[15px] font-medium leading-snug text-white/90 sm:text-base sm:font-normal sm:text-white/80">
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-3 rounded-xl border border-de-hairline bg-de-raised px-4 py-3"
                    >
                      <IconWell icon={stat.icon} size="sm" />
                      <div>
                        <div className="font-mono text-lg font-semibold text-white">{stat.value}</div>
                        <div className="text-xs text-white/55">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white/60">Built for regulated environments</span>
                  {["HIPAA-aligned support", "SOC 2 readiness", "Cyber insurance readiness", "Framework mapping"].map(
                    (badge) => (
                      <span
                        key={badge}
                        className="rounded-md border border-de-hairline bg-transparent px-3 py-1.5 text-xs text-white/70"
                      >
                        {badge}
                      </span>
                    ),
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {["Microsoft Partner", "Apple Consultants"].map((badge) => (
                    <span
                      key={badge}
                      className="rounded-md border border-de-hairline bg-transparent px-3 py-1.5 text-xs text-white/70"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 w-full border-white/35 bg-transparent px-6 text-base font-semibold text-white shadow-none hover:border-white/55 hover:bg-white/5 sm:w-auto"
                  >
                    <Link href={CTA.secondaryHref}>{CTA.secondary}</Link>
                  </Button>
                  <a
                    href={PRIMARY_PHONE.telHref}
                    className="text-base font-medium text-pink-300 underline decoration-pink-400/40 underline-offset-4 transition-colors hover:text-pink-200 hover:decoration-pink-300/70"
                  >
                    Or call {PRIMARY_PHONE.display}
                  </a>
                </div>
              </motion.div>

              <motion.div
                id="city-assessment"
                className="w-full"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: prefersReducedMotion ? 0 : 0.08 }}
              >
                <div className="de-paper-lift-lg rounded-2xl p-6 md:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D3126A]">
                    {props.city} Cyber Risk Assessment
                  </p>
                  <h2 className="font-heading text-xl md:text-2xl font-bold tracking-[-0.02em] text-[#1A1228] mt-1">
                    Get Your Free {props.city} Security Assessment
                  </h2>
                  <p className="mb-4 mt-1 text-base text-[#2A2438]">
                    Tell us about your environment. We will follow up with independent findings you can use with your current IT or with us.
                  </p>

                  <div className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-[var(--de-paper-hairline)] bg-white px-4 py-3 sm:grid-cols-3">
                    <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                      <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                      <span>On-site {props.city} support</span>
                    </div>
                    <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                      <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                      <span>No switch required</span>
                    </div>
                    <div className="flex items-baseline gap-2 text-xs font-semibold text-[#1A1228]">
                      <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                      <span>Arizona-based team</span>
                    </div>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-[#1A1228]">Full Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="John Smith"
                                  data-testid={`input-${props.city.toLowerCase()}-name`}
                                  className={paperFieldClass}
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
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-[#1A1228]">Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="john@company.com"
                                  data-testid={`input-${props.city.toLowerCase()}-email`}
                                  className={paperFieldClass}
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
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-[#1A1228]">Phone Number</FormLabel>
                              <FormControl>
                                <Input
                                  type="tel"
                                  placeholder="(480) 000-0000"
                                  data-testid={`input-${props.city.toLowerCase()}-phone`}
                                  className={paperFieldClass}
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
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-[#1A1228]">Company Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Your Company Inc."
                                  data-testid={`input-${props.city.toLowerCase()}-company`}
                                  className={paperFieldClass}
                                  disabled={isSubmitting}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                        <Button
                          type="submit"
                          size="lg"
                          variant="brand"
                          data-testid={`button-${props.city.toLowerCase()}-submit`}
                          disabled={isSubmitting}
                          className="h-12 flex-1 text-base font-semibold"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              {CTA.primary}
                              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                            </>
                          )}
                        </Button>
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="lg"
                          className="h-12 w-full border-[var(--de-paper-hairline)] bg-white px-6 text-base font-semibold text-[#1A1228] hover:border-[#D3126A] hover:bg-[#D3126A]/5 sm:w-auto"
                        >
                          <a href={PRIMARY_PHONE.telHref} className="sm:flex-shrink-0">
                            <Phone className="mr-2 h-5 w-5" aria-hidden="true" />
                            {PRIMARY_PHONE.display}
                          </a>
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--de-surface)] py-12 md:py-16" aria-label="Greater Phoenix cities">
        <div className="mx-auto w-[min(94vw,1100px)] px-4">
          <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
            Serving Greater Phoenix
            <span className="text-[#D3126A]" aria-hidden="true">
              :
            </span>
          </h2>
          <div className="mt-6 grid grid-cols-2 content-stretch gap-3 sm:grid-cols-3">
            {GREATER_PHOENIX_CITIES.map((location) => {
              const isCurrent = location.slug === currentSlug;
              return (
                <Link
                  key={location.slug}
                  href={location.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`${cityChipClass} ${
                    isCurrent
                      ? "border-[#D3126A] text-white shadow-[inset_0_0_0_1px_#D3126A]"
                      : "border-[var(--de-hairline)]"
                  }`}
                  data-city={location.name.toLowerCase()}
                  data-testid={`location-switcher-${location.name.toLowerCase()}`}
                >
                  {location.name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-de-hairline bg-[var(--de-bg)] py-10" aria-label="Arizona cybersecurity context">
        <div className="mx-auto w-[min(94vw,900px)] px-4">
          {(() => {
            const azFact = getCyberFact("az-ic3-losses-2024");
            return (
              <motion.div
                className="rounded-2xl border border-de-hairline bg-de-raised px-6 py-5 text-center"
                initial={fadeUp}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
              >
                <p className="mb-2 text-xs uppercase tracking-wider text-[#D3126A]">Arizona context</p>
                <p className="text-sm leading-relaxed text-white/90 md:text-base">
                  <span className="font-bold text-white">{azFact.metric}</span> {azFact.statement} — relevant for{" "}
                  {props.city} and Greater Phoenix SMBs planning insurance-ready IT and breach readiness.
                </p>
                {azFact.sourceUrl ? (
                  <a
                    href={azFact.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-white/55 underline-offset-2 hover:text-[#D3126A] hover:underline"
                  >
                    — {formatFactSource(azFact)}
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-white/55">— {formatFactSource(azFact)}</p>
                )}
              </motion.div>
            );
          })()}
        </div>
      </section>

      <section className="bg-[var(--de-surface)] py-20">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div
            className="mb-12 text-center"
            initial={fadeUp}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              IT Services for <span className="text-[#D3126A]">{props.city}</span> Businesses
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-white/65">{props.serviceRadius}</p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {props.serviceFocus.map((service, index) => {
              const IconComponent = serviceIcons[index % serviceIcons.length];
              return (
                <motion.div
                  key={service}
                  className="rounded-2xl border border-de-hairline bg-de-raised p-6"
                  initial={fadeUp}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: prefersReducedMotion ? 0 : index * 0.04 }}
                >
                  <IconWell icon={IconComponent} className="mb-4" />
                  <h3 className="text-xl font-semibold text-white">{service}</h3>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[var(--de-paper)] py-20">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div
            className="mb-12 text-center"
            initial={fadeUp}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            <h2 className="text-3xl font-bold text-[#1A1228] md:text-4xl">
              Why {props.city} Chooses <span className="text-[#A30E52]">Digerati Experts</span>
            </h2>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {props.whyChooseUs.map((reason, index) => (
              <motion.div
                key={reason}
                className="de-paper-lift flex gap-4 rounded-xl p-5"
                initial={fadeUp}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: prefersReducedMotion ? 0 : index * 0.04 }}
              >
                <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-[#A30E52]" aria-hidden="true" />
                <p className="text-[#1A1228]/80">{reason}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--de-surface)] py-20">
        <div className="mx-auto w-[min(94vw,1400px)] px-4">
          <motion.div
            className="mb-10 text-center"
            initial={fadeUp}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            <h2 className="text-3xl font-bold text-white md:text-4xl">Industries We Serve in {props.city}</h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3">
            {props.localProof.industries.map((industry) => (
              <span
                key={industry}
                className="rounded-lg border border-de-hairline bg-de-raised px-5 py-2.5 text-white/80"
              >
                {industry}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--de-bg)] py-20">
        <div className="mx-auto w-[min(94vw,1400px)] px-4 text-center">
          <motion.h2
            className="mb-4 text-3xl font-bold text-white md:text-4xl"
            initial={fadeUp}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            Neighborhoods We Serve
          </motion.h2>
          <p className="mb-8 text-white/65">{props.serviceRadius}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {props.neighborhoods.map((area) => (
              <span key={area} className="rounded-lg border border-de-hairline bg-de-raised px-5 py-2.5 text-white/80">
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--de-surface)] py-20">
        <div className="mx-auto w-[min(94vw,1200px)] px-4">
          <ConversionPathBar
            headline={props.cta}
            body={`Contact our ${props.city} team today — start with a Cyber Risk Assessment.`}
          />
        </div>
      </section>

      <DigeratiEnhancedFooterSection />
    </>
  );
}
