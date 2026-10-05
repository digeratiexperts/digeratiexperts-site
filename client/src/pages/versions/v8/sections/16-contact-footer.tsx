import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useToast } from "@/hooks/use-toast";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { COMPANY, COMPANY_SOCIAL, PRIMARY_PHONE, formatAddressOneLine } from "@/data/companyContact";
// Closing bookend (Joe 2026-08-31): the hero's Phoenix city-lights plate returns behind the contact chapter.
import contactBgImage from "@assets/de-hero-arizona-dusk-1600.webp";
import { CopyButton } from "./CopyButton";
import { FieldOk, SubmitFace, submitPhase, useSentFlash } from "./SubmitFace";
import "./16-contact-footer.css";

/**
 * Section 16 (mock: artifacts/design-concepts/homepage-sections-2026-10/sections/16-contact-footer.html).
 * Contact chapter (form contract from DigeratiContactSection.tsx: POST /api/contact) and the footer
 * (links + the page's one newsletter form from DigeratiEnhancedFooterSection.tsx: POST /api/newsletter).
 */

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

/** Same values the live Radix select posts. */
const serviceOptions = [
  { value: "managed-security", label: "Managed Security Services" },
  { value: "managed-it", label: "Managed IT Services" },
  { value: "compliance", label: "Compliance & Governance" },
  { value: "incident-response", label: "Incident Response" },
  { value: "assessment", label: "Security Assessment" },
];

const clientLinks = [
  { name: "Client Portal", href: "https://portal.digeratiexperts.com/portal/login" },
  { name: "Submit Ticket", href: "/support/submit-ticket" },
  { name: "Remote Support", href: "https://assist.zoho.com/" },
  { name: "Pay Invoice", href: "/support/pay-invoice" },
];

const serviceLinks = [
  { name: "Managed IT", href: "/solutions/managed-it-support" },
  { name: "Cybersecurity", href: "/solutions/security-operations" },
  { name: "Compliance & Risk", href: "/solutions/compliance-reports" },
  { name: "Backup & DR", href: "/solutions/backup-disaster-recovery" },
];

const resourceLinks = [
  { name: "Digerati Journal", href: "/resources/blog" },
  { name: "Cyber Facts", href: "/resources/cyber-facts" },
  { name: "Knowledge Base", href: "/support/knowledge-base" },
  { name: "Contact", href: "/contact" },
];

const trustLegalLinks = [
  { name: "Trust Center", href: "/trust/trust-center" },
  { name: "Status", href: "/trust/trust-center" },
  { name: "Vulnerability Disclosure", href: "/trust/vulnerability-disclosure" },
  { name: "Privacy", href: "/legal/privacy-policy" },
  { name: "Terms", href: "/legal/terms-of-use" },
  { name: "MSA", href: "/legal/msa" },
  { name: "SLA", href: "/legal/sla" },
];

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const socialIcons: Record<string, JSX.Element> = {
  linkedin: (
    <svg {...svgProps}>
      <path d="M16 8a6 6 0 0 1 6 6v8h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
  twitter: (
    <svg {...svgProps}>
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  ),
  facebook: (
    <svg {...svgProps}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V8a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  instagram: (
    <svg {...svgProps}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  ),
};

const socialLinks = [
  { ...COMPANY_SOCIAL.linkedin, key: "linkedin", testId: "footer-linkedin" },
  { ...COMPANY_SOCIAL.twitter, key: "twitter", testId: "footer-twitter" },
  { ...COMPANY_SOCIAL.facebook, key: "facebook", testId: "footer-facebook" },
  { ...COMPANY_SOCIAL.instagram, key: "instagram", testId: "footer-instagram" },
];

function FootLink({ href, name, testId }: { href: string; name: string; testId: string }) {
  const isExternal = /^https?:\/\//i.test(href);
  return (
    <li>
      <a href={href} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})} data-testid={testId}>
        {name}
      </a>
    </li>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="v8-field-error" id={id} role="alert">
      {message}
    </p>
  );
}

function ContactForm(): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [sent, flashSent] = useSentFlash();

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
  const { errors } = form.formState;

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
        description: "We'll get back to you within one business day.",
        variant: "default",
      });

      form.reset();
      flashSent();
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

  const described = (field: keyof ContactFormData) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `c-${field}-error` } : {};

  const phase = submitPhase(isSubmitting, sent);

  return (
    <form
      className="v8-card--paper contact__card"
      noValidate
      aria-labelledby="contact-form-title"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <h3 className="v8-h3" id="contact-form-title">
        Get in Touch
      </h3>
      <p className="v8-body">Tell us about the environment. We'll follow up on a Cyber Risk Assessment — no hard sell.</p>
      <div className="fields">
        <div className="is-full v8-float">
          <label className="v8-label" htmlFor="c-name">
            Your Name *
          </label>
          <input
            className="v8-input"
            id="c-name"
            type="text"
            placeholder=" "
            autoComplete="name"
            required
            data-testid="input-contact-name"
            disabled={isSubmitting}
            {...described("name")}
            {...form.register("name")}
          />
          <FieldOk />
          <FieldError id="c-name-error" message={errors.name?.message} />
        </div>
        <div className="v8-float">
          <label className="v8-label" htmlFor="c-email">
            Business Email *
          </label>
          <input
            className="v8-input"
            id="c-email"
            type="email"
            placeholder=" "
            autoComplete="email"
            required
            data-testid="input-contact-email"
            disabled={isSubmitting}
            {...described("email")}
            {...form.register("email")}
          />
          <FieldOk />
          <FieldError id="c-email-error" message={errors.email?.message} />
        </div>
        <div className="v8-float">
          <label className="v8-label" htmlFor="c-phone">
            Phone Number *
          </label>
          <input
            className="v8-input"
            id="c-phone"
            type="tel"
            placeholder=" "
            autoComplete="tel"
            required
            data-testid="input-contact-phone"
            disabled={isSubmitting}
            {...described("phone")}
            {...form.register("phone")}
          />
          <FieldOk />
          <FieldError id="c-phone-error" message={errors.phone?.message} />
        </div>
        <div className="v8-float">
          <label className="v8-label" htmlFor="c-company">
            Company Name
          </label>
          <input
            className="v8-input"
            id="c-company"
            type="text"
            placeholder=" "
            autoComplete="organization"
            data-testid="input-contact-company"
            disabled={isSubmitting}
            {...form.register("company")}
          />
        </div>
        <div className="v8-float">
          <label className="v8-label" htmlFor="c-service">
            Service Interested In
          </label>
          <div className="select">
            <select
              className="v8-input"
              id="c-service"
              data-testid="select-contact-service"
              disabled={isSubmitting}
              {...form.register("service")}
            >
              <option value="">Select a service</option>
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg {...svgProps}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
        <div className="is-full v8-float">
          <label className="v8-label" htmlFor="c-message">
            Message
          </label>
          <textarea
            className="v8-input"
            id="c-message"
            rows={4}
            placeholder=" "
            data-testid="textarea-contact-message"
            disabled={isSubmitting}
            {...described("message")}
            {...form.register("message")}
          />
          <FieldError id="c-message-error" message={errors.message?.message} />
        </div>
      </div>
      <button
        className="v8-btn v8-btn--dark contact__submit v8-submit"
        type="submit"
        disabled={isSubmitting}
        data-state={phase}
        data-testid="button-send-message"
      >
        <SubmitFace phase={phase} sendingLabel="Sending your message" sentLabel="Message sent">
          Send Message
        </SubmitFace>
      </button>
    </form>
  );
}

function FooterNewsletter(): JSX.Element {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSubmit = async (e: FormEvent) => {
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
    <div className="foot__news">
      <div>
        <h2 className="v8-meta foot__head" id="fn-head">
          Stay Updated
        </h2>
        <p>Get the latest cybersecurity insights and IT tips delivered to your inbox.</p>
      </div>
      {isSubscribed ? (
        <p className="foot__thanks" role="status">
          <svg {...svgProps}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Thank you for subscribing!</span>
        </p>
      ) : (
        <form className="foot__form" onSubmit={handleNewsletterSubmit} aria-labelledby="fn-head">
          <label className="v8-sr" htmlFor="footer-newsletter-email">
            Enter your email
          </label>
          <input
            className="v8-input"
            id="footer-newsletter-email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
            data-testid="footer-newsletter-input"
          />
          <button
            className="v8-btn v8-btn--outline"
            type="submit"
            disabled={isSubmitting}
            data-testid="footer-newsletter-submit"
          >
            <svg {...svgProps}>
              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
              <path d="m21.854 2.147-10.94 10.939" />
            </svg>
            Subscribe
          </button>
        </form>
      )}
    </div>
  );
}

export function V8ContactFooter(): JSX.Element {
  const reduceMotion = useReducedMotion();
  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: revealInitial,
          whileInView: revealInView,
          viewport: revealViewport,
          transition: { ...revealTransition, delay },
        };
  const currentYear = new Date().getFullYear();

  return (
    <>
      <section
        className="f-well v8-section contact"
        aria-labelledby="contact-title"
        data-testid="homepage-contact-chapter"
      >
        <img
          className="contact__plate"
          src={contactBgImage}
          alt=""
          width={1600}
          height={1067}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
        <div className="contact__drift" aria-hidden="true" />
        <div className="v8-canvas contact__grid">
          <motion.div className="contact__copy" {...reveal()}>
            <p className="v8-eyebrow">Contact</p>
            <h2 className="v8-h2" id="contact-title">
              Ready to Secure Your Business?
            </h2>
            <p className="v8-lede">
              Located in the heart of Chandler, we&apos;re your local cybersecurity experts. Whether you need immediate
              help or want to explore our services, we&apos;re here for you.
            </p>
            <div className="contact__actions">
              <a className="v8-link" href="/book" data-testid="contact-cta-assessment">
                {CTA.primary}{" "}
                <svg {...svgProps}>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
              <a className="v8-btn v8-btn--outline" href={PRIMARY_PHONE.telHref} data-testid="contact-cta-call">
                Call {PRIMARY_PHONE.display}
              </a>
            </div>

            <ul className="dir">
              <li>
                <span className="v8-iconwell">
                  <svg {...svgProps}>
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <span className="v8-meta">Email</span>
                <span className="dir__copyrow">
                  <a className="dir__value" href={`mailto:${COMPANY.email}`} data-testid="contact-email">
                    {COMPANY.email}
                  </a>
                  <CopyButton value={COMPANY.email} what="email address" testId="contact-email-copy" />
                </span>
              </li>
              <li>
                <span className="v8-iconwell">
                  <svg {...svgProps}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <span className="v8-meta">Phone</span>
                <span className="dir__copyrow">
                  <a className="dir__value" href={PRIMARY_PHONE.telHref} data-testid="contact-phone">
                    {PRIMARY_PHONE.display}
                  </a>
                  <CopyButton value={PRIMARY_PHONE.display} what="phone number" testId="contact-phone-copy" />
                </span>
              </li>
              <li>
                <span className="v8-iconwell">
                  <svg {...svgProps}>
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="v8-meta">Office</span>
                <a
                  className="dir__value"
                  href={COMPANY.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-address"
                >
                  {formatAddressOneLine()}
                </a>
              </li>
              <li className="dir__top" data-testid="contact-office-hours">
                <span className="v8-iconwell">
                  <svg {...svgProps}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <span className="v8-meta">Office Hours</span>
                <div className="hours__wrap">
                  <dl className="hours">
                    <dt>Monday - Friday</dt>
                    <dd>7:00 AM - 6:00 PM MST</dd>
                    <dt>Saturday &amp; Sunday</dt>
                    <dd>Emergency Support Only</dd>
                  </dl>
                  <p className="hours__soc">
                    <svg {...svgProps}>
                      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    </svg>
                    <span>24/7/365 emergency incident{" "}response</span>
                  </p>
                </div>
              </li>
            </ul>
          </motion.div>

          <motion.div {...reveal(0.04)}>
            <ContactForm />
          </motion.div>
        </div>
      </section>

      <footer className="f-chrome foot">
        <div className="v8-canvas">
          <div className="foot__grid">
            <div className="foot__brand">
              <img className="foot__logo" src={DE_LOGO_REVERSE} alt="Digerati Experts Logo" data-testid="logo-footer" />
              <p className="foot__name">{COMPANY.legalName}</p>
              <p className="foot__line">
                Arizona MSP
                <br />
                Cybersecurity &amp; Managed IT
                <br />
                Chandler, Arizona
              </p>
            </div>

            <nav className="foot__col" aria-labelledby="fc-client">
              <h2 className="v8-meta foot__head" id="fc-client">
                Client
              </h2>
              <ul>
                {clientLinks.map((link, index) => (
                  <FootLink key={link.name} {...link} testId={`footer-client-${index}`} />
                ))}
              </ul>
            </nav>
            <nav className="foot__col" aria-labelledby="fc-services">
              <h2 className="v8-meta foot__head" id="fc-services">
                Services
              </h2>
              <ul>
                {serviceLinks.map((link, index) => (
                  <FootLink key={link.name} {...link} testId={`footer-service-${index}`} />
                ))}
              </ul>
            </nav>
            <nav className="foot__col" aria-labelledby="fc-resources">
              <h2 className="v8-meta foot__head" id="fc-resources">
                Resources
              </h2>
              <ul>
                {resourceLinks.map((link, index) => (
                  <FootLink key={link.name} {...link} testId={`footer-resource-${index}`} />
                ))}
              </ul>
            </nav>
            <nav className="foot__col foot__col--trust" aria-labelledby="fc-trust">
              <h2 className="v8-meta foot__head" id="fc-trust">
                Trust &amp; Legal
              </h2>
              <div className="foot__split">
                <ul>
                  {trustLegalLinks.slice(0, 3).map((link, index) => (
                    <FootLink key={link.name} {...link} testId={`footer-trust-legal-${index}`} />
                  ))}
                </ul>
                <ul>
                  {trustLegalLinks.slice(3).map((link, index) => (
                    <FootLink key={link.name} {...link} testId={`footer-trust-legal-${index + 3}`} />
                  ))}
                </ul>
              </div>
            </nav>
          </div>

          <FooterNewsletter />

          <div className="foot__legal">
            <p>
              <span>
                © {currentYear} {COMPANY.legalName}
              </span>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <a href="/locations/chandler-az" data-testid="footer-bottom-chandler">
                Chandler, Arizona
              </a>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <a href="/trust/accessibility" data-testid="footer-bottom-accessibility">
                Accessibility
              </a>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <a href="/trust/trust-center" data-testid="footer-bottom-security">
                Security
              </a>
            </p>
            <div className="social">
              {socialLinks.map((social) => (
                <a
                  key={social.key}
                  href={social.href}
                  aria-label={social.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={social.testId}
                >
                  {socialIcons[social.key]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
