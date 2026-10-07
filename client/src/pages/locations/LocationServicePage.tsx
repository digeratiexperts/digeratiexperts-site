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
import { SituationContinuityStrip } from "@/components/SituationContinuityStrip";
import { situationSubmitPayload, useAnonymousSituation } from "@/lib/anonymousSituation";
import { getCyberFact, formatFactSource } from "@/data/cyberAwarenessFacts";
import { CTA } from "@/lib/ctaCopy";
import { COMPANY, COMPANY_SOCIAL, PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";
import { GREATER_PHOENIX_CITIES, cityPageSlug } from "@/data/greaterPhoenixCities";
import { credentialsOfKind } from "@/data/credentials";
import { IconWell } from "@/components/visual/IconWell";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FeatureGrid,
  IndexedList,
  PageHero,
  buttonSecondary,
} from "@/components/site/chapters";

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
  /** ≤155-char search snippet; `description` doubles as on-page copy and was 250–280 chars. */
  metaDescription?: string;
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
  "inline-flex h-full min-h-12 w-full items-center justify-center rounded-lg border bg-white px-4 py-4 text-base font-medium text-[#1A1228] transition-colors hover:border-[#D3126A] hover:text-[#A30E52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] sm:min-h-14 md:text-lg";

export function LocationServicePage(props: LocationPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const currentSlug = cityPageSlug(props.city);
  const situation = useAnonymousSituation();

  useSEO({
    title: props.title,
    description: props.metaDescription ?? props.description,
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
          ...situationSubmitPayload(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || "Submission failed");
      }
      toast({
        title: "Assessment Request Submitted!",
        description: `We'll contact you within one business day to schedule your free ${props.city} assessment.`,
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
    { icon: Zap, value: "15 min", label: "Critical response (SLA)" },
    { icon: Clock, value: "24/7", label: "Monitoring" },
  ];

  const features = [
    { icon: FileCheck, text: "Insurance & Compliance-Ready" },
    { icon: Shield, text: "24/7 Human-Led Monitoring" },
    { icon: Building, text: `Built for ${props.city} Businesses` },
    { icon: CheckCircle, text: "Easy-to-Read Risk Reports" },
  ];


  const regulatedBadges = ["HIPAA-aligned support", "SOC 2 readiness", "Cyber insurance readiness", "Framework mapping"];
  // Partner programs only from the verified list (client/src/data/credentials.ts).
  const partnerBadges = credentialsOfKind(["partner"]).map((c) => c.name);
  const azFact = getCyberFact("az-ic3-losses-2024");

  return (
    <div className="min-h-screen bg-de-bg">
      <MegaMenu />

      <main id="main-content" tabIndex={-1}>
        <PageHero
          eyebrow={props.localArea}
          title={
            <>
              {props.city} Businesses Deserve <span className="text-de-accent-ink">Better IT.</span>
            </>
          }
          lede={props.description}
          actions={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={CTA.secondaryHref} className={buttonSecondary("well")}>
                {CTA.secondary}
              </Link>
              <a href={PRIMARY_PHONE.telHref} className={buttonSecondary("well")}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                Or call <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>
              </a>
            </div>
          }
          note={`Built for regulated environments: ${regulatedBadges.join(" · ")}.${partnerBadges.length ? ` ${partnerBadges.join(" · ")}.` : ""}`}
          asideOnMobile
          aside={
            <div id="city-assessment" className="w-full min-w-0 [contain:inline-size]">
                <div className="de-paper-lift-lg rounded-2xl p-6 md:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D3126A]">
                        {props.city} Cyber Risk Assessment
                      </p>
                      <h2 className="font-heading text-xl md:text-2xl font-bold tracking-[-0.02em] text-[#1A1228] mt-1">
                        Get Your Free {props.city} Security Assessment
                      </h2>
                      <p className="mb-4 mt-1 text-base text-[#2A2438]">
                        {situation
                          ? "We'll size this conversation against the environment you already started in the Store. You do not need to retype users, computers, or sites."
                          : "Tell us about your environment. We will follow up with independent findings you can use with your current IT or with us."}
                      </p>
                      {situation ? (
                        <SituationContinuityStrip situation={situation} door="assessment" tone="paper" className="mb-4" />
                      ) : null}
    
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
                              className="h-12 text-base font-semibold sm:flex-1"
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
            </div>
          }
        />

        <div data-testid="section-location-stats">
          <FactStrip
            label={`Why ${props.city} businesses choose Digerati Experts`}
            facts={features.map((f) => ({ icon: f.icon, title: f.text }))}
          />
        </div>

        <Chapter tone="well" seam={false} data-testid="section-location-services">
          <Container>
            <ChapterHeader
              tone="well"
              eyebrow="Services"
              title={
                <>
                  IT Services for {props.city} Businesses
                </>
              }
              lede={props.serviceRadius}
            />
            <FeatureGrid
              tone="well"
              items={props.serviceFocus.map((service, index) => ({
                icon: serviceIcons[index % serviceIcons.length],
                title: service,
              }))}
            />
          </Container>
        </Chapter>

        <Chapter tone="paper" data-testid="section-location-why">
          <Container>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-5">
                <ChapterHeader
                  tone="paper"
                  layout="stack"
                  eyebrow="Why Digerati Experts"
                  title={`Why ${props.city} Chooses Digerati Experts`}
                  className="mb-8"
                />
                <dl className="divide-y divide-[var(--de-paper-hairline)] border-y border-[var(--de-paper-hairline)]">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-4 py-4">
                      <IconWell icon={stat.icon} size="sm" surface="light" />
                      <div>
                        <dd className="font-mono text-lg font-semibold text-[#1A1228]">{stat.value}</dd>
                        <dt className="text-sm text-[#3A3448]">{stat.label}</dt>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="lg:col-span-7">
                <CheckList tone="paper" columns={1} items={props.whyChooseUs} />
              </div>
            </div>
          </Container>
        </Chapter>

        <Chapter plate="locations" tone="surface" aria-label="Arizona cybersecurity context" data-testid="section-location-context">
          <Container>
            <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-14">
              <div className="lg:col-span-4">
                <ChapterHeader tone="surface" layout="stack" eyebrow="Arizona context" title="Why it matters locally" className="mb-0" />
              </div>
              <div className="lg:col-span-8">
                <p className="font-heading text-2xl font-semibold leading-snug text-white md:text-3xl">
                  <span className="text-de-magenta-ink">{azFact.metric}</span> {azFact.statement}
                </p>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                  Relevant for {props.city} and Greater Phoenix SMBs planning insurance-ready IT and breach readiness.
                </p>
                {azFact.sourceUrl ? (
                  <a
                    href={azFact.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center text-sm text-white/60 underline-offset-2 hover:text-white hover:underline"
                  >
                    — {formatFactSource(azFact)}
                  </a>
                ) : (
                  <p className="mt-4 text-sm text-white/60">— {formatFactSource(azFact)}</p>
                )}
              </div>
            </div>
          </Container>
        </Chapter>

        <Chapter tone="well" data-testid="section-location-reach">
          <Container>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
              <div>
                <ChapterHeader
                  tone="well"
                  layout="stack"
                  eyebrow="Industries"
                  title={`Industries We Serve in ${props.city}`}
                  as="h2"
                  className="mb-6"
                />
                <IndexedList tone="well" columns={2} items={props.localProof.industries.map((t) => ({ title: t }))} />
              </div>
              <div>
                <ChapterHeader
                  tone="well"
                  layout="stack"
                  eyebrow="Coverage"
                  title="Neighborhoods We Serve"
                  lede={props.serviceRadius}
                  className="mb-6"
                />
                <IndexedList tone="well" columns={2} items={props.neighborhoods.map((t) => ({ title: t }))} />
              </div>
            </div>
          </Container>
        </Chapter>

        <Chapter tone="paper" aria-label="Greater Phoenix cities" data-testid="section-location-cities">
          <Container>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-7">
                <h2 className="font-heading text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-[#1A1228] md:text-4xl">
                  Serving Greater Phoenix
                  <span className="text-de-accent-ink" aria-hidden="true">
                    :
                  </span>
                </h2>
                <div className="mt-8 grid grid-cols-2 content-stretch gap-3 sm:grid-cols-3">
                  {GREATER_PHOENIX_CITIES.map((location) => {
                    const isCurrent = location.slug === currentSlug;
                    return (
                      <Link
                        key={location.slug}
                        href={location.href}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`${cityChipClass} ${
                          isCurrent
                            ? "border-[#D3126A] text-[#A30E52] shadow-[inset_0_0_0_1px_#D3126A]"
                            : "border-[var(--de-paper-hairline)]"
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
              <div className="lg:col-span-5">
                <div className="de-paper-lift rounded-xl p-6" data-testid="location-office">
                  <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-paper-ink">
                    Our office
                  </p>
                  <p className="font-heading text-lg font-semibold text-[#1A1228]">{COMPANY.legalName}</p>
                  <address className="mt-2 not-italic leading-relaxed text-[#3A3448]">{formatAddressOneLine()}</address>
                  <p className="mt-3 text-sm leading-relaxed text-[#3A3448]">
                    {props.city} clients are served from our Chandler office and by remote support.
                  </p>
                  <a
                    href={PRIMARY_PHONE.telHref}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-de-magenta-paper-ink underline-offset-4 hover:underline"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>
                  </a>
                </div>
              </div>
            </div>
          </Container>
        </Chapter>

        <ClosingCta
          eyebrow="Cyber risk assessment & support"
          title={props.cta}
          lede={`Contact our ${props.city} team today — start with a Cyber Risk Assessment.`}
          primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
          phoneTestId="button-conversion-call"
        />
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
}
