// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiEnhancedFooterSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { Linkedin, Twitter, Facebook, Instagram, CheckCircle, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { COMPANY, COMPANY_SOCIAL } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";
import { BookingLink } from "@/components/BookingButton";
import logoImage from "@assets/DE-Logo-new_1762461524794.webp";

const FooterLink = ({ href, children, testId }: { href: string; children: React.ReactNode; testId: string }) => {
  const isExternal = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-base text-white/55 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-[#D3126A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
      data-testid={testId}
    >
      {children}
    </a>
  );
};

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

const footerColumns = [
  { title: "Client", links: clientLinks, testIdPrefix: "footer-client" },
  { title: "Services", links: serviceLinks, testIdPrefix: "footer-service" },
  { title: "Resources", links: resourceLinks, testIdPrefix: "footer-resource" },
  { title: "Trust & Legal", links: trustLegalLinks, testIdPrefix: "footer-trust-legal" },
];

export const DigeratiEnhancedFooterSection = (): JSX.Element => {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
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

  const socialLinks = [
    { ...COMPANY_SOCIAL.linkedin, icon: Linkedin, testId: "footer-linkedin" },
    { ...COMPANY_SOCIAL.twitter, icon: Twitter, testId: "footer-twitter" },
    { ...COMPANY_SOCIAL.facebook, icon: Facebook, testId: "footer-facebook" },
    { ...COMPANY_SOCIAL.instagram, icon: Instagram, testId: "footer-instagram" },
  ];

  return (
    <footer className="de-dark-well de-chapter-hairline relative">
      <div className="container relative z-10 mx-auto max-w-[1440px] px-3 pt-12 sm:px-4 lg:px-6 lg:pt-16">
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="min-w-0 md:col-span-2 lg:col-span-4">
            <img
              src={logoImage}
              alt="Digerati Experts Logo"
              className="mb-4 h-12 w-auto"
              data-testid="logo-footer"
            />
            <p className="text-base font-medium text-white">Digerati Experts</p>
            <p className="mt-1 text-base text-white/55">
              Arizona MSP · Cybersecurity &amp; Managed IT
            </p>
            <p className="mt-1 text-base text-white/55">
              <a
                href="/locations/chandler-az"
                className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                data-testid="footer-brand-chandler"
              >
                Chandler, Arizona
              </a>
            </p>

            <BookingLink
              source="footer"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#D3126A] px-5 text-base font-semibold text-white transition-colors hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              data-testid="footer-cta-assessment"
            >
              {CTA.primary}
            </BookingLink>

            <div className="mt-8 max-w-sm">
              <h4 className="mb-2 text-base font-semibold uppercase tracking-[0.16em] text-white">
                Stay Updated
              </h4>
              <p className="mb-3 text-base text-white/55">
                Get the latest cybersecurity insights and IT tips delivered to your inbox.
              </p>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-de-accent-ink">
                  <CheckCircle className="h-5 w-5" aria-hidden="true" />
                  <span className="text-base">Thank you for subscribing!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="footer-newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="footer-newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isSubmitting}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-de-hairline bg-de-raised px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]"
                    data-testid="footer-newsletter-input"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-semibold text-[#1A1228] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)] disabled:opacity-60"
                    data-testid="footer-newsletter-submit"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Subscribe</span>
                  </button>
                </form>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-de-hairline text-white/55 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                  aria-label={social.name}
                  data-testid={social.testId}
                >
                  <social.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <nav className="contents" aria-label="Footer">
            {footerColumns.map((column) => (
              <div key={column.title} className="min-w-0 lg:col-span-2">
                <h4 className="mb-3 text-base font-semibold uppercase tracking-[0.16em] text-white">
                  {column.title}
                </h4>
                <ul className="space-y-2">
                  {column.links.map((item, index) => (
                    <li key={item.name}>
                      <FooterLink href={item.href} testId={`${column.testIdPrefix}-${index}`}>
                        {item.name}
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-de-hairline py-6">
          <p className="text-base text-white/50">
            <span>© {currentYear} {COMPANY.legalName}</span>
            <span aria-hidden="true"> · </span>
            <a
              href="/locations/chandler-az"
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              data-testid="footer-bottom-chandler"
            >
              Chandler, Arizona
            </a>
            <span aria-hidden="true"> · </span>
            <a
              href="/trust/accessibility"
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              data-testid="footer-bottom-accessibility"
            >
              Accessibility
            </a>
            <span aria-hidden="true"> · </span>
            <a
              href="/trust/trust-center"
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              data-testid="footer-bottom-security"
            >
              Security
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
