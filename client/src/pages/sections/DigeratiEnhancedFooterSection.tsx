import { Shield, Phone, Mail, MapPin, Linkedin, Twitter, Facebook, Instagram, ExternalLink, Lock, FileText, ArrowRight, CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";
import logoImage from '@assets/DE-Logo-new_1762461524794.webp';

const CircuitOverlay = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="footer-circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
        <path d="M10 10h80v80h-80z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="10" cy="10" r="2" fill="currentColor"/>
        <circle cx="90" cy="10" r="2" fill="currentColor"/>
        <circle cx="10" cy="90" r="2" fill="currentColor"/>
        <circle cx="90" cy="90" r="2" fill="currentColor"/>
        <circle cx="50" cy="50" r="3" fill="currentColor"/>
        <path d="M10 50h30M60 50h30M50 10v30M50 60v30" stroke="currentColor" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#footer-circuit)" className="text-purple-400"/>
  </svg>
);

const FooterLink = ({ href, children, testId }: { href: string; children: React.ReactNode; testId: string }) => (
  <a 
    href={href} 
    className="group relative text-gray-400 hover:text-white text-sm transition-all duration-300 inline-block"
    data-testid={testId}
  >
    <span className="relative">
      {children}
      <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-violet-500 transition-all duration-300 group-hover:w-full" />
    </span>
  </a>
);

const socialButtonVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  }),
  hover: {
    scale: 1.15,
    transition: { duration: 0.2 }
  }
};

export const DigeratiEnhancedFooterSection = (): JSX.Element => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubscribing) return;

    setIsSubscribing(true);
    setSubscriptionError("");

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'We could not add you right now.');
      }
      setIsSubscribed(true);
      setEmail("");
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : 'Please try again in a moment.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const quickAccess = [
    { name: "Client Portal", href: "https://portal.digeratiexperts.com/portal/login" },
    { name: "Submit Ticket", href: "/support/submit-ticket" },
    { name: "Remote Support", href: "/support/remote-support" },
    { name: "Pay Invoice", href: "/support/pay-invoice" },
    { name: "Knowledge Base", href: "/support/knowledge-base" },
    { name: "System Status", href: "/portal/status" }
  ];

  const services = [
    { name: "Managed IT", href: "/solutions/managed-it-support" },
    { name: "Cybersecurity", href: "/solutions/security-operations" },
    { name: "Compliance & Risk", href: "/solutions/compliance-reports" },
    { name: "Backup & DR", href: "/solutions/backup-disaster-recovery" },
    { name: "Threat Detection", href: "/solutions/threat-detection" },
    { name: "Security Training", href: "/solutions/security-awareness" }
  ];

  const legal = [
    { name: "MSA", badge: "v2025.1", href: "/legal/msa" },
    { name: "SLA", badge: "v2025.1", href: "/legal/sla" },
    { name: "AUP", badge: "v2025.1", href: "/legal/aup" },
    { name: "DPA", badge: "v2025.1", href: "/legal/dpa" },
    { name: "Privacy Policy", href: "/legal/privacy-policy" },
    { name: "Terms of Use", href: "/legal/terms-of-use" },
    { name: "Sample SOW", href: "/legal/sample-sow" }
  ];

  const trust = [
    { name: "Trust Center", href: "/trust/trust-center" },
    { name: "Status Page", href: "/portal/status" },
    { name: "Vulnerability Disclosure", href: "/trust/vulnerability-disclosure" },
    { name: "security.txt", href: "/.well-known/security.txt" },
    { name: "Accessibility", href: "/trust/accessibility" }
  ];

  const locations = [
    { name: "Chandler", href: "/locations/chandler-az", primary: true },
    { name: "Phoenix", href: "/locations/phoenix-az", primary: false },
    { name: "Gilbert", href: "/locations/gilbert-az", primary: false },
    { name: "Tempe", href: "/locations/tempe-az", primary: false },
    { name: "Mesa", href: "/locations/mesa-az", primary: false },
    { name: "Scottsdale", href: "/locations/scottsdale-az", primary: false }
  ];

  const assuranceAreas = [
    { name: "Security Documentation", icon: Shield, available: true },
    { name: "HIPAA Readiness", icon: Lock, available: true },
    { name: "Cyber Insurance", icon: CheckCircle, available: true },
    { name: "Vendor Reviews", icon: CheckCircle, available: true }
  ];

  const socialLinks = [
    { name: "LinkedIn", href: "https://www.linkedin.com/company/digerati-experts", icon: Linkedin, testId: "footer-linkedin", color: "hover:bg-[#0077B5] hover:border-[#0077B5]" },
    { name: "Twitter", href: "https://twitter.com/digerati_experts", icon: Twitter, testId: "footer-twitter", color: "hover:bg-[#1DA1F2] hover:border-[#1DA1F2]" },
    { name: "Facebook", href: "https://www.facebook.com/digeratiexperts", icon: Facebook, testId: "footer-facebook", color: "hover:bg-[#1877F2] hover:border-[#1877F2]" },
    { name: "Instagram", href: "https://www.instagram.com/digerati.experts", icon: Instagram, testId: "footer-instagram", color: "hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] hover:border-[#833AB4]" }
  ];

  return (
    <footer className="relative bg-[#0f0f0f] border-t border-violet-500/20 overflow-hidden">
      <CircuitOverlay />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_50%)] pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 max-w-[1440px] relative z-10">
        <div className="mb-12 pl-4 md:pl-8 lg:pl-0">
          <img 
            src={logoImage} 
            alt="Digerati Experts Logo" 
            className="h-12 w-auto"
            data-testid="logo-footer"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 mb-12 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Quick Access - Dark Style */}
          <div className="p-8 bg-[#0a0a0a] relative group border-r border-white/10 transition-colors hover:bg-[#0d0d0d]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.08)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <h4 className="text-white font-semibold mb-6 text-sm uppercase tracking-wider relative z-10">Quick Access</h4>
            <ul className="space-y-3 relative z-10">
              {quickAccess.map((item, index) => (
                <li key={index}>
                  <FooterLink href={item.href} testId={`footer-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    {item.name}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Services - Glassmorphism Style */}
          <div className="p-8 bg-white/[0.02] backdrop-blur-xl relative group border-r border-white/10 transition-colors hover:bg-white/[0.04]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,0.04)_0%,transparent_100%)]" />
            <h4 className="text-white font-semibold mb-6 text-sm uppercase tracking-wider relative z-10">Services</h4>
            <ul className="space-y-3 relative z-10">
              {services.map((item, index) => (
                <li key={index}>
                  <FooterLink href={item.href} testId={`footer-service-${index}`}>
                    {item.name}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal - Dark Style (same as Quick Access) */}
          <div className="p-8 bg-[#0a0a0a] relative group border-r border-white/10 transition-colors hover:bg-[#0d0d0d]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(139,92,246,0.08)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <h4 className="text-white font-semibold mb-6 text-sm uppercase tracking-wider relative z-10">Legal</h4>
            <ul className="space-y-3 relative z-10">
              {legal.map((item, index) => (
                <li key={index}>
                  <a 
                    href={item.href} 
                    className="group/link relative text-gray-400 hover:text-white text-sm transition-all duration-300 inline-flex items-center gap-2 font-normal"
                    data-testid={`footer-legal-${index}`}
                  >
                    <span className="relative">
                      {item.name}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-violet-500 transition-all duration-300 group-hover/link:w-full" />
                    </span>
                    {item.badge && (
                      <span className="text-[10px] bg-violet-600/50 text-white/80 px-1.5 py-0.5 rounded-full border border-violet-500/30">
                        {item.badge}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust - Glassmorphism Style (same as Services) */}
          <div className="p-8 bg-white/[0.02] backdrop-blur-xl relative group transition-colors hover:bg-white/[0.04]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,0.04)_0%,transparent_100%)]" />
            <h4 className="text-white font-semibold mb-6 text-sm uppercase tracking-wider relative z-10">Trust</h4>
            <ul className="space-y-3 relative z-10">
              {trust.map((item, index) => (
                <li key={index}>
                  <FooterLink href={item.href} testId={`footer-trust-${index}`}>
                    {item.name}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-8 px-4 md:px-8 lg:px-0">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8 shadow-[0_0_40px_rgba(139,92,246,0.1)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <Shield className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 flex items-center gap-2 ">
                    EVIDENCE READY
                  </h3>
                  <p className="text-gray-400 text-sm font-normal">
                    Need security documentation or questionnaire help?
                  </p>
                  <p className="text-gray-500 text-sm mt-1 font-normal">
                    Ask for service-specific evidence for vendor onboarding, insurance, or security reviews
                  </p>
                </div>
              </div>
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] whitespace-nowrap transition-all duration-300"
                data-testid="footer-request-docs"
              >
                Request Docs
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 py-8 px-4 md:px-8 lg:px-0">
          <h4 className="text-white text-sm font-semibold mb-6 uppercase tracking-wider ">
            Assurance Areas
          </h4>
          <div className="flex flex-wrap gap-4">
            {assuranceAreas.map((area, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                data-testid={`footer-seal-${index}`}
              >
                <area.icon className="h-5 w-5 text-purple-400" />
                <span className="text-gray-400 text-sm font-medium ">{area.name}</span>
                {area.available && (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 py-8 px-4 md:px-8 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden group hover:bg-white/[0.05] transition-colors">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_70%)]" />
              <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider relative z-10">
                Stay Updated
              </h4>
              <p className="text-gray-400 text-sm mb-6 relative z-10">
                Get the latest cybersecurity insights and IT tips delivered to your inbox.
              </p>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-green-400 relative z-10">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm ">Thank you for subscribing!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-3 relative z-10">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    aria-label="Email address for newsletter"
                    required
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 text-sm"
                    data-testid="footer-newsletter-input"
                  />
                  <button
                    type="submit"
                    disabled={isSubscribing}
                    aria-label="Subscribe to newsletter"
                    className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300 flex items-center gap-2"
                    data-testid="footer-newsletter-submit"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline ">{isSubscribing ? 'Joining…' : 'Subscribe'}</span>
                  </button>
                </form>
              )}
              {subscriptionError && (
                <p className="mt-3 text-sm text-red-300 relative z-10" role="alert">{subscriptionError}</p>
              )}
            </div>
            
            <div className="p-8 bg-[#0a0a0a] border border-white/10 rounded-3xl h-full flex flex-col justify-center relative overflow-hidden group hover:bg-[#0d0d0d] transition-colors">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(139,92,246,0.05)_0%,transparent_70%)]" />
              <h4 className="text-white text-sm font-semibold mb-6 uppercase tracking-wider relative z-10 text-center">
                Serving Greater Phoenix
              </h4>
              <div className="honeycomb-grid relative z-10">
                {locations.map((location, index) => (
                  <a
                    key={index}
                    href={location.href}
                    className="city-btn"
                    data-city={location.name.toLowerCase()}
                    data-testid={`footer-location-${location.name.toLowerCase()}`}
                  >
                    {location.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 pb-8 px-4 md:px-8 lg:px-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-300 ${social.color}`}
                  aria-label={social.name}
                  data-testid={social.testId}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  whileHover="hover"
                  viewport={{ once: true }}
                  variants={socialButtonVariants}
                >
                  <social.icon className="h-5 w-5" />
                </motion.a>
              ))}
            </div>
            
            <div className="text-gray-500 text-sm text-center font-normal">
              © {currentYear} Digerati Experts, LLC. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
